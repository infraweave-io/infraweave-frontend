# Deploy Setup — S3 + CloudFront

One-time infrastructure for hosting this static SPA on AWS. After this is done, the GitHub
workflows in [.github/workflows/](../.github/workflows/) handle everything automatically:

- **PR opened/updated** → `deploy-preview.yml` publishes a mock-mode preview to `s3://<bucket>/pr-<N>/`
  and comments the URL on the PR.
- **PR closed** → `deploy-preview-cleanup.yml` removes `pr-<N>/`.
- **Push to `main`** → `deploy-production.yml` publishes the real build to the bucket root `/`.

Previews and production share **one bucket and one CloudFront distribution**. Production lives
at the root; each PR preview lives under a `pr-<N>/` prefix.

> **No secrets are involved.** Everything the app ships (API Gateway URL, Cognito domain +
> clientId) is public by design, and auth uses PKCE. All config below goes in GitHub
> **Variables**, not Secrets.

---

## Prerequisites

- AWS CLI configured with an admin/deploy profile.
- A domain you control for production (needed because the Cognito redirect URI must be an
  exact, pre-registered origin).

Set these shell vars to follow along (replace values):

```bash
export AWS_REGION=us-west-2
export BUCKET=infraweave-frontend-web           # must be globally unique
export REPO=infraweave-io/infraweave-frontend   # owner/name
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

---

## 1. GitHub OIDC provider + IAM deploy role

Lets the workflows assume a role with no long-lived keys.

```bash
# Create the OIDC provider (skip if it already exists in the account).
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Trust policy: only this repo may assume the role.
cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:${REPO}:*" }
    }
  }]
}
EOF

aws iam create-role --role-name infraweave-frontend-deploy \
  --assume-role-policy-document file://trust-policy.json

# Permissions: write to the bucket + invalidate the distribution.
cat > deploy-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::${BUCKET}", "arn:aws:s3:::${BUCKET}/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy --role-name infraweave-frontend-deploy \
  --policy-name deploy --policy-document file://deploy-policy.json

aws iam get-role --role-name infraweave-frontend-deploy --query Role.Arn --output text
# ^ this ARN becomes the AWS_ROLE_ARN GitHub variable.
```

---

## 2. Private S3 bucket

Private bucket, no website hosting — CloudFront reads it via Origin Access Control (OAC).

```bash
aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

---

## 3. ACM certificate (us-east-1) + custom domain

CloudFront requires certs in **us-east-1**.

```bash
aws acm request-certificate --region us-east-1 \
  --domain-name app.example.com \
  --validation-method DNS
```

Add the DNS validation CNAME to your DNS provider, wait for `ISSUED`, and note the cert ARN.

---

## 4. CloudFront distribution + SPA routing function

Create a **CloudFront Function** (viewer-request) that rewrites extensionless paths to the
right `index.html` — this is what makes deep links and PR-preview subpaths work:

```js
function handler(event) {
  var req = event.request;
  var uri = req.uri;

  // Real asset (has a file extension) → serve as-is.
  if (uri.match(/\.[a-zA-Z0-9]+$/)) return req;

  // PR preview subpath (/pr-123/anything) → that preview's index.html.
  var m = uri.match(/^\/(pr-\d+)\//);
  if (m) {
    req.uri = '/' + m[1] + '/index.html';
    return req;
  }

  // Everything else → production index.html.
  req.uri = '/index.html';
  return req;
}
```

Then create the distribution (console or CLI) with:

- **Origin**: the S3 bucket, access restricted via **Origin Access Control (OAC)**.
- **Default root object**: `index.html`.
- **Viewer protocol policy**: redirect HTTP → HTTPS.
- **Alternate domain (CNAME)**: `app.example.com`, using the ACM cert from step 3.
- **Function association**: attach the function above to the **viewer-request** event.

After creation, AWS prints an S3 bucket policy statement to allow the distribution's OAC —
apply it with `aws s3api put-bucket-policy`. Point your domain's DNS at the CloudFront
domain (`dxxxx.cloudfront.net`) via an ALIAS/CNAME record.

Note the **distribution ID** and **domain**.

---

## 5. Cognito callback URL (production only)

Add the production callback to the Cognito app client's allowed callback URLs. The app builds
its redirect URI as `${window.location.origin}/callback`
(see [src/features/auth/login/LoginPage.tsx](../src/features/auth/login/LoginPage.tsx#L44)):

```
https://app.example.com/callback
```

Preview URLs need **nothing** here — mock mode disables auth entirely.

---

## 6. GitHub repository Variables

App config (`REACT_APP_*`) is **not** set in GitHub — it lives in the committed
`.env.staging` / `.env.production` files and is baked in at build time via
`vite build --mode <env>`. GitHub only holds the AWS deploy infra.

**Settings → Secrets and variables → Actions → Variables** — set these per
Environment (`staging`, `production`) and at repo level for PR previews. All
public, so Variables not Secrets:

| Variable                     | Example                                               |
| ---------------------------- | ----------------------------------------------------- |
| `AWS_ROLE_ARN`               | `arn:aws:iam::<acct>:role/infraweave-frontend-deploy` |
| `AWS_REGION`                 | `us-west-2`                                           |
| `S3_BUCKET`                  | `infraweave-frontend-web`                             |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1234567890ABC`                                      |
| `PREVIEW_BASE_URL`           | `https://app.example.com` (no trailing slash)         |

To change the backend URL, Cognito client, etc., edit `.env.staging` /
`.env.production` and commit — no GitHub changes needed.

Done. Open a PR to test the preview flow; merge to `main` to test production.
