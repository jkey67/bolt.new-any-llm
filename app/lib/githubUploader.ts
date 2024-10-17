import { WebContainer } from '@webcontainer/api';
import { webcontainer } from './webcontainer';
import { env } from 'node:process';

 // Store securely!
// List of paths or file names to be exempted
const EXEMPT_PATHS = [
  '/node_modules',
  '/.git',
  '/dist',
  '/build',
  '/coverage',
  'package-lock.json',
  '.env',
  '.DS_Store',
];

// Function to create an initial commit in the repository
async function createInitialCommit(): Promise<string> {
  const treeUrl = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/git/trees`;

  // Create an empty tree
  const emptyTreeResponse = await fetch(treeUrl, {
    method: 'POST',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      tree: [] // Empty tree
    }),
  });

  if (!emptyTreeResponse.ok) {
    const errorData = await emptyTreeResponse.json();
    if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
      throw new Error(`Failed to create empty tree: ${(errorData as { message: string }).message}`);
    } else {
      throw new Error('Failed to create empty tree: Unknown error');
    }
  }

  const emptyTreeData = await emptyTreeResponse.json();
  const emptyTreeSha = (emptyTreeData as { sha: string }).sha;

  const commitUrl = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/git/commits`;
  const commitResponse = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      message: 'Initial commit',
      tree: emptyTreeSha,
      parents: [] // No parents for the first commit
    }),
  });

  if (!commitResponse.ok) {
    const errorData = await commitResponse.json();
    if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
      throw new Error(`Failed to create initial commit: ${(errorData as { message: string }).message}`);
    } else {
      throw new Error('Failed to create initial commit: Unknown error');
    }
  }

  const commitData = await commitResponse.json() as { sha: string };
  return commitData.sha; // Return the initial commit SHA
}

// Function to create the main branch from the initial commit
async function createMainBranch(commitSha: string) {
  const refUrl = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/git/refs`;
  const refResponse = await fetch(refUrl, {
    method: 'POST',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      ref: 'refs/heads/main',
      sha: commitSha
    }),
  });

  if (!refResponse.ok) {
    const errorData = await refResponse.json();
    if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
      throw new Error(`Failed to create main branch: ${(errorData as { message: string }).message}`);
    } else {
      throw new Error('Failed to create main branch: Unknown error');
    }
  }

  console.log('Main branch created successfully.');
}

// Function to initialize the repository if not initialized
async function ensureRepositoryIsInitialized() {
  try {
    // Try to get the branch info
    const url = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/git/refs/heads/main`;
    const checkResponse = await fetch(url, {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (checkResponse.status === 404) {
      console.log('Main branch does not exist. Initializing repository...');

      // Create the initial commit
      const initialCommitSha = await createInitialCommit();

      // Create the main branch
      await createMainBranch(initialCommitSha);
    } else {
      console.log('Repository is already initialized.');
    }
  } catch (error) {
    console.error('Error ensuring repository is initialized:', error);
    throw error;
  }
}

// Function to upload a file using GitHub's contents API
async function uploadFileToGitHub(filePath: string, fileContent: string) {
  const relativeFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
  const sha = await getFileSha(relativeFilePath); // Check if file exists
  const url = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${relativeFilePath}`;

  const encodedContent = btoa(unescape(encodeURIComponent(fileContent))); // Base64 encode

  const requestBody = {
    message: `Add/update ${relativeFilePath}`,
    content: encodedContent,
    branch: 'main',
    sha: sha || undefined
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
      throw new Error(`Failed to upload ${relativeFilePath}: ${(errorData as { message: string }).message}`);
    } else {
      throw new Error(`Failed to upload ${relativeFilePath}: Unknown error`);
    }
  }

  console.log(`${relativeFilePath} uploaded successfully.`);
  return await response.json();
}

// Full function to ensure repo is initialized and files are uploaded
export async function uploadToGitHub() {
  try {
    // Ensure the repository is initialized
    await ensureRepositoryIsInitialized();

    const container = await webcontainer;
    const files = await getAllFiles('/', container);

    for (const filePath of files) {
      const fileContent = await container.fs.readFile(filePath, 'utf8');
      const relativeFilePath = filePath.replace(/^\/home\/project\//, '');
      await uploadFileToGitHub(relativeFilePath, fileContent);
    }

    console.log('All files uploaded to GitHub successfully!');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error uploading files to GitHub:', error.message);
    } else {
      console.error('Error uploading files to GitHub:', error);
    }
    throw error;
  }
}




// Function to get the file's SHA (needed to update an existing file)
async function getFileSha(filePath: string): Promise<string | null> {
  const relativeFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath; // Remove leading slash
  const url = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${relativeFilePath}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (response.status === 404) {
    return null; // File doesn't exist, so we will create it
  }

  if (!response.ok) {
    throw new Error(`Failed to get file SHA for ${filePath}: ${response.statusText}`);
  }

  const data = await response.json() as { sha: string };
  return data.sha; // Existing file's SHA needed for updates
}

// Helper to retrieve all files
async function getAllFiles(dir: string, container: any, filesList: string[] = []): Promise<string[]> {
  const entries = await container.fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`.replace('//', '/');
    if (EXEMPT_PATHS.some(exemptPath => fullPath.includes(exemptPath))) continue;
    if (entry.isDirectory()) {
      await getAllFiles(fullPath, container, filesList);
    } else {
      filesList.push(fullPath);
    }
  }
  return filesList;
}



