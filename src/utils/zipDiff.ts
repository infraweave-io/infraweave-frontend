import JSZip from 'jszip';
import { VersionDiff } from '../types/Module';
import { DefaultLinesDiffComputer } from 'vscode-diff';

function getRootFolder(zip: JSZip): string {
  const files = Object.keys(zip.files).filter(
    (f) => !f.startsWith('__MACOSX') && !f.endsWith('.DS_Store'),
  );

  const rootCounts = new Map<string, number>();

  for (const file of files) {
    const parts = file.split('/');
    if (parts.length > 1) {
      const root = `${parts[0]}/`;
      rootCounts.set(root, (rootCounts.get(root) || 0) + 1);
    }
  }

  let bestRoot = '';
  let maxCount = 0;

  for (const [root, count] of rootCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      bestRoot = root;
    }
  }

  return bestRoot;
}

export async function compareZips(
  currentZip: JSZip,
  selectedZip: JSZip,
  selectedVersion: string,
): Promise<VersionDiff> {
  const currentRoot = getRootFolder(currentZip);
  const selectedRoot = getRootFolder(selectedZip);

  const normalize = (path: string, root: string) => {
    if (root && path.startsWith(root)) {
      return path.substring(root.length);
    }
    return root ? `../${path}` : path;
  };

  const currentFiles = new Map<string, JSZip.JSZipObject>();
  currentZip.forEach((relativePath, entry) => {
    if (!entry.dir && !relativePath.startsWith('__MACOSX') && !relativePath.endsWith('.DS_Store')) {
      const path = normalize(relativePath, currentRoot);
      currentFiles.set(path, entry);
    }
  });

  const selectedFiles = new Map<string, JSZip.JSZipObject>();
  selectedZip.forEach((relativePath, entry) => {
    if (!entry.dir && !relativePath.startsWith('__MACOSX') && !relativePath.endsWith('.DS_Store')) {
      const path = normalize(relativePath, selectedRoot);
      selectedFiles.set(path, entry);
    }
  });

  const allPaths = new Set([...currentFiles.keys(), ...selectedFiles.keys()]);

  const added: { path: string; value: string }[] = [];
  const removed: { path: string; value: string }[] = [];
  const changed: { path: string; old_value: string; new_value: string }[] = [];
  const unchanged: { path: string; value: string }[] = [];

  const normalizeContent = (str: string) => str.replace(/\r\n/g, '\n');

  for (const path of allPaths) {
    const currentEntry = currentFiles.get(path);
    const selectedEntry = selectedFiles.get(path);

    // Determine the display path based on the current zip's structure
    let displayPath = `/${path}`;

    if (currentEntry) {
      displayPath = `/${currentEntry.name}`;
    } else {
      // For removed files, we try to place them where they would be in the current structure
      if (path.startsWith('../')) {
        displayPath = `/${path.substring(3)}`;
      } else if (currentRoot) {
        displayPath = `/${currentRoot}${path}`;
      } else {
        displayPath = `/${path}`;
      }
    }

    if (currentEntry && !selectedEntry) {
      const content = await currentEntry.async('string');
      added.push({ path: displayPath, value: normalizeContent(content) });
    } else if (!currentEntry && selectedEntry) {
      const content = await selectedEntry.async('string');
      removed.push({ path: displayPath, value: normalizeContent(content) });
    } else if (currentEntry && selectedEntry) {
      const [currentContentRaw, selectedContentRaw] = await Promise.all([
        currentEntry.async('string'),
        selectedEntry.async('string'),
      ]);

      const currentContent = normalizeContent(currentContentRaw);
      const selectedContent = normalizeContent(selectedContentRaw);

      if (currentContent !== selectedContent) {
        changed.push({
          path: displayPath,
          old_value: selectedContent,
          new_value: currentContent,
        });
      } else {
        unchanged.push({
          path: displayPath,
          value: currentContent,
        });
      }
    }
  }

  // Detect moved files
  const diffComputer = new DefaultLinesDiffComputer();
  const addedIndicesToRemove: number[] = [];
  const removedIndicesToRemove: number[] = [];
  const moved: { oldPath: string; newPath: string; old_value: string; new_value: string }[] = [];

  const calculateSimilarity = (
    text1: string,
    text2: string,
    _path1: string,
    _path2: string,
  ): number => {
    if (text1 === text2) return 1;
    if (normalizeContent(text1) === normalizeContent(text2)) return 1;

    const lines1 = text1.split(/\r?\n/);
    const lines2 = text2.split(/\r?\n/);

    if (lines1.length === 0 && lines2.length === 0) return 1;
    if (lines1.length === 0 || lines2.length === 0) return 0;

    const result = diffComputer.computeDiff(lines1, lines2, {
      ignoreTrimWhitespace: true,
      maxComputationTimeMs: 1000,
      computeMoves: false,
    });

    let changedOriginalLines = 0;
    for (const change of result.changes) {
      changedOriginalLines +=
        change.original.endLineNumberExclusive - change.original.startLineNumber;
    }

    return (lines1.length - changedOriginalLines) / lines1.length;
  };

  const potentialMoves: { removedIndex: number; addedIndex: number; score: number }[] = [];

  for (let j = 0; j < removed.length; j++) {
    for (let i = 0; i < added.length; i++) {
      const score = calculateSimilarity(
        removed[j].value,
        added[i].value,
        removed[j].path,
        added[i].path,
      );
      if (score > 0.4) {
        potentialMoves.push({ removedIndex: j, addedIndex: i, score });
      }
    }
  }

  potentialMoves.sort((a, b) => b.score - a.score);

  for (const move of potentialMoves) {
    if (
      removedIndicesToRemove.includes(move.removedIndex) ||
      addedIndicesToRemove.includes(move.addedIndex)
    ) {
      continue;
    }

    moved.push({
      oldPath: removed[move.removedIndex].path,
      newPath: added[move.addedIndex].path,
      old_value: removed[move.removedIndex].value,
      new_value: added[move.addedIndex].value,
    });
    addedIndicesToRemove.push(move.addedIndex);
    removedIndicesToRemove.push(move.removedIndex);
  }

  const finalAdded = added.filter((_, i) => !addedIndicesToRemove.includes(i));
  const finalRemoved = removed.filter((_, i) => !removedIndicesToRemove.includes(i));

  const result = {
    added: finalAdded,
    removed: finalRemoved,
    changed,
    moved,
    unchanged,
    previous_version: selectedVersion,
  };

  return result;
}
