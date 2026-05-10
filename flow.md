## 🔐 Complete SSO/Cognito Authentication Flow

### **1. Initial Load (User Not Authenticated)**

```
Browser → StandaloneApp checks localStorage for 'auth_token'
       → Token not found
       → Renders <LoginPage />
```

### **2. User Clicks "Login with AWS"**

```
LoginPage → Generates random state, saves to localStorage
         → Redirects to: https://{COGNITO_DOMAIN}/oauth2/authorize?
                         client_id={CLIENT_ID}
                         &response_type=code
                         &scope=openid+profile+email
                         &redirect_uri=http://localhost:3000/callback
                         &state={random_state}
```

### **3. Cognito Hosted UI**

```
Cognito → Shows login options (Username/Password or "IAMIdentityCenter" SAML)
       → User clicks "IAMIdentityCenter"
       → Redirects to IAM Identity Center SAML login
       → User authenticates with SSO credentials
       → IAM Identity Center sends SAML assertion back to Cognito
       → Cognito validates SAML assertion
       → Cognito redirects to: http://localhost:3000/callback?code={AUTH_CODE}&state={state}
```

### **4. OAuth Callback (Frontend)**

```
OAuthCallback component:
  ├─ Extracts code and state from URL
  ├─ Verifies state matches localStorage (CSRF protection)
  ├─ Exchanges code directly with Cognito:
  │  POST https://{COGNITO_DOMAIN}/oauth2/token
  │  Body: {
  │    grant_type: "authorization_code",
  │    client_id: CLIENT_ID,
  │    code: AUTH_CODE,
  │    redirect_uri: "http://localhost:3000/callback"
  │  }
  │
  ├─ Receives Cognito tokens:
  │  { id_token: "...", access_token: "...", refresh_token: "..." }
  │
  ├─ Stores in localStorage:
  │  • auth_token = id_token (Cognito JWT)
  │  • access_token = access_token
  │  • refresh_token = refresh_token
  │  • user = decoded user info from id_token
  │
  └─ Redirects to: window.location.href = '/'
```

### **5. Rust Backend Authentication**

```rust
// Your Rust backend validates the Cognito ID token on each request:

Middleware on protected endpoints:
  ├─ Extracts Bearer token from Authorization header
  │
  ├─ Validates Cognito ID token:
  │  ├─ Verify JWT signature using Cognito JWKS
  │  │  GET https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
  │  ├─ Verify token not expired (exp claim)
  │  ├─ Verify issuer matches Cognito User Pool
  │  └─ Verify audience (aud) matches Client ID
  │
  ├─ Extracts user info from validated token claims:
  │  { email: "user@example.com", sub: "...", cognito:username: "..." }
  │
  ├─ Optional: Check additional authorization:
  │  • Verify user's AWS Organization membership
  │  • Check Cognito groups
  │  • Validate email domain
  │
  └─ Allows request to proceed with user context
```

### **6. App Reload After Authentication**

```
Browser → Navigates to '/'
       → StandaloneApp checks localStorage for 'auth_token'
       → Token found!
       → Calls onLoginSuccess()
       → Renders main application UI
```

### **7. Making API Calls**

```
Frontend component calls API:
  └─ Uses apiFetch('/api/v1/projects')
     │
     ├─ Gets auth_token (Cognito ID token) from localStorage
     │
     └─ Makes request:
        GET http://localhost:8080/api/v1/projects
        Headers: {
          Authorization: "Bearer <COGNITO_ID_TOKEN>",
          Content-Type: "application/json"
        }

Rust backend:
  ├─ Extracts Bearer token from Authorization header
  ├─ Validates Cognito ID token:
  │  ├─ Verifies JWT signature against Cognito JWKS
  │  ├─ Checks token not expired
  │  └─ Verifies issuer and audience
  ├─ Extracts user info from token claims
  │  (email, sub, cognito:username, cognito:groups, etc.)
  ├─ Uses user context to make AWS API calls
  └─ Returns data to frontend
```

### **8. Token Refresh**

```
When ID token expires:
  ├─ Frontend detects 401 Unauthorized (or checks token expiry)
  │
  ├─ Frontend exchanges refresh token directly with Cognito:
  │  POST https://{COGNITO_DOMAIN}/oauth2/token
  │  Body: {
  │    grant_type: "refresh_token",
  │    client_id: CLIENT_ID,
  │    refresh_token: REFRESH_TOKEN
  │  }
  │
  ├─ Receives new tokens:
  │  { id_token: "...", access_token: "..." }
  │  (Note: refresh_token is NOT rotated by Cognito by default)
  │
  ├─ Updates localStorage with new tokens
  └─ Retries failed request with new ID token

OR if refresh fails (token revoked/expired):
  └─ Redirects user back to login page
```

---

## 📋 What You Need to Configure

### **Frontend (.env)**

```bash
REACT_APP_API_URL=http://localhost:8080
REACT_APP_AWS_COGNITO_DOMAIN=your-app.auth.us-west-2.amazoncognito.com
REACT_APP_AWS_CLIENT_ID=your-cognito-client-id
```

### **Cognito Setup (AWS Console)**

1. Create Cognito User Pool
2. Create App Client (public, no secret)
3. Configure callback URLs: `http://localhost:3000/callback`
4. Set up SAML federation with IAM Identity Center
5. Enable Hosted UI

### **Rust Backend**

```rust
// Environment variables you need:
COGNITO_REGION="us-west-2"
COGNITO_USER_POOL_ID="us-west-2_XXXXX"
COGNITO_CLIENT_ID="..." // Optional: for audience validation

// Backend validates tokens using:
// https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
```

---

## 🔑 Key Security Points

1. **CSRF Protection**: State parameter verified in callback
2. **HTTPS in Production**: All OAuth flows must use HTTPS
3. **Token Storage**: JWT in localStorage (consider httpOnly cookies for better security)
4. **Token Validation**: Always verify JWT signature and expiry in Rust backend
5. **SAML Trust**: IAM Identity Center → Cognito trust configured via SAML metadata

## 🔄 Multi-Cloud Authentication Architecture

### **Option 1: Separate Auth Per Cloud (Recommended)**

Each cloud provider has its own OAuth flow:

**AWS Flow:**

```
Login → Cognito → IAM Identity Center (SAML) → Cognito callback → Rust backend
```

**Azure Flow:**

```
Login → Azure AD/Entra ID → Azure SSO → Azure AD callback → Rust backend
```

**GCP Flow:**

```
Login → Google Identity Platform → Google Workspace SSO → Google callback → Rust backend
```

### **Implementation in Your Frontend**

Update LoginPage.tsx to show multiple cloud options:

```tsx
const handleLogin = (provider: 'aws' | 'azure' | 'gcp') => {
  const state = Math.random().toString(36).substring(7);
  localStorage.setItem('oauth_state', state);
  localStorage.setItem('oauth_provider', provider); // Track which provider

  if (provider === 'aws') {
    // Cognito OAuth
    const authUrl = `https://${COGNITO_DOMAIN}/oauth2/authorize?...`;
    window.location.href = authUrl;
  } else if (provider === 'azure') {
    // Azure AD OAuth
    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?
      client_id=${AZURE_CLIENT_ID}
      &response_type=code
      &redirect_uri=${encodeURIComponent(window.location.origin + '/callback')}
      &scope=openid+profile+email
      &state=${state}`;
    window.location.href = authUrl;
  } else if (provider === 'gcp') {
    // Google OAuth
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?
      client_id=${GOOGLE_CLIENT_ID}
      &response_type=code
      &redirect_uri=${encodeURIComponent(window.location.origin + '/callback')}
      &scope=openid+profile+email
      &state=${state}`;
    window.location.href = authUrl;
  }
};
```

### **Your Rust Backend**

Single unified callback endpoint that handles all providers:

```rust
POST /auth/callback
  ├─ Receives: { code, provider } // provider = 'aws' | 'azure' | 'gcp'
  │
  ├─ Match on provider:
  │  ├─ AWS:
  │  │  ├─ Exchange code with Cognito token endpoint
  │  │  ├─ Get user info from ID token
  │  │  └─ Optional: Verify AWS Organization membership
  │  │
  │  ├─ Azure:
  │  │  ├─ Exchange code with Azure AD token endpoint
  │  │  ├─ GET https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
  │  │  ├─ Get user info from ID token or Microsoft Graph API
  │  │  └─ Optional: Verify Azure AD group membership
  │  │
  │  └─ GCP:
  │     ├─ Exchange code with Google token endpoint
  │     ├─ GET https://oauth2.googleapis.com/token
  │     ├─ Get user info from ID token or Google API
  │     └─ Optional: Verify Google Workspace domain
  │
  ├─ Create unified JWT token with claims:
  │  {
  │    sub: user_id,
  │    email: email,
  │    provider: 'aws' | 'azure' | 'gcp',
  │    cloud_permissions: {...}
  │  }
  │
  └─ Return: { token: "YOUR_JWT", user: {...} }
```

### **Environment Variables**

```bash
# AWS
COGNITO_DOMAIN=your-app.auth.us-west-2.amazoncognito.com
COGNITO_CLIENT_ID=...

# Azure
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-app-id
AZURE_CLIENT_SECRET=your-secret # Azure requires a secret

# GCP
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret

# Your backend
JWT_SECRET=your-secret
```

### **Updated OAuthCallback Component**

```tsx
const handleCallback = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const provider = localStorage.getItem('oauth_provider') || 'aws';

  // Verify state (CSRF protection)
  // ...

  // Send to your Rust backend
  const response = await fetch(`${API_URL}/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, provider }), // Tell backend which provider
  });

  const data = await response.json();
  localStorage.setItem('auth_token', data.token);
  window.location.href = '/';
};
```

### **Azure AD Setup**

1. **Azure Portal** → **Azure Active Directory** → **App registrations**
2. Create new app registration
3. Add redirect URI: `http://localhost:3000/callback`
4. Create client secret
5. API permissions: `User.Read`, `openid`, `profile`, `email`
6. Optional: Configure Azure AD group for access control

### **Benefits of This Approach**

✅ **Single codebase** - One frontend, one backend
✅ **Unified token** - Same JWT format regardless of provider
✅ **Provider abstraction** - Backend handles cloud-specific OAuth flows
✅ **Multi-cloud support** - Users can authenticate with any cloud they use
✅ **Centralized auth logic** - All in your Rust backend

### **Making Cloud API Calls**

Your Rust backend knows which cloud the user authenticated with:

```rust
// Extract from JWT
let provider = claims.provider; // 'aws' | 'azure' | 'gcp'

match provider {
    "aws" => {
        // Use AWS SDK with user's identity
        let config = aws_config::load_from_env().await;
        let orgs_client = aws_sdk_organizations::Client::new(&config);
        // Make AWS API calls
    }
    "azure" => {
        // Use Azure SDK with user's identity
        let credential = DefaultAzureCredential::new()?;
        // Make Azure API calls
    }
    "gcp" => {
        // Use GCP SDK with user's identity
        // Make GCP API calls
    }
}
```

Want me to help you implement the multi-cloud login UI or the Rust backend auth endpoints?
