import JSZip from 'jszip';
import { webcontainer } from './webcontainer';

// List of paths or file names to be exempted from the ZIP
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

// Function to retrieve all files recursively
async function getAllFiles(dir: string, container: any, filesList: string[] = []): Promise<string[]> {
  const entries = await container.fs.readdir(dir, { withFileTypes: true });


  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`.replace('//', '/');

    // Skip exempted paths
    if (EXEMPT_PATHS.some(exemptPath => fullPath.includes(exemptPath))) continue;

    if (entry.isDirectory()) {
      console.log(`Directory: ${fullPath}`);
      await getAllFiles(fullPath, container, filesList); // Recursively add files from directories
    } else {
      console.log(`File: ${fullPath}`);
      filesList.push(fullPath); // Add file path to the list
    }
  }
  return filesList;
}

// Function to create ZIP file from project directory
async function createProjectZip(): Promise<Blob> {
  const container = await webcontainer; // Ensure container is ready
  const files = await getAllFiles('/', container); // Get all files from root directory
  const zip = new JSZip();

  console.log('Files to be added to ZIP:', files); // Debugging

  // Add each file to the ZIP
  for (const filePath of files) {
    try {
      const fileContent = await container.fs.readFile(filePath, 'utf8'); // Read file content
      const relativeFilePath = filePath.replace(/^\/home\/project\//, '').replace(/^\//, ''); // Adjust relative path (no leading slash)
      console.log(`Adding file to ZIP: ${relativeFilePath}`); // Debugging
      zip.file(relativeFilePath, fileContent); // Add file to ZIP without leading slash
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error); // Handle any file reading errors
    }
  }

  // Generate ZIP file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

// Function to trigger file download in browser
function downloadZipFile(zipBlob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url); // Clean up
}

// Main function to download project ZIP
export async function downloadProjectZip() {
  try {
    const zipBlob = await createProjectZip(); // Create the ZIP file
    downloadZipFile(zipBlob, 'project.zip'); // Trigger the download
    console.log('Project ZIP downloaded successfully!');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error creating ZIP:', error.message);
    } else {
      console.error('An unknown error occurred while creating ZIP.');
    }
  }
}

// Refined Test function to check reading directory contents
// export async function testReadDir() {
//   try {
//     const container = await webcontainer; // Ensure container is ready
//     const rootEntries = await container.fs.readdir('/', { withFileTypes: true }); // Read root directory

//     for (const entry of rootEntries) {
//       const fullPath = `/${entry.name}`;

//       if (entry.isDirectory()) {
//         console.log(`Directory: ${fullPath}`);
//         // Optionally, explore deeper by reading this directory's contents
//         const subEntries = await container.fs.readdir(fullPath, { withFileTypes: true });
//         console.log(`Contents of ${fullPath}:`, subEntries.map(e => e.name));
//       } else {
//         console.log(`File: ${fullPath}`);
//       }
//     }
//   } catch (error) {
//     console.error('Error reading root directory:', error);
//   }
// }



// // Test function to read a single file content
// export async function testReadFile() {
//   try {
//     const container = await webcontainer;
//     const fileContent = await container.fs.readFile('/index.html', 'utf8'); // Try reading index.html
//     console.log('File content of /index.html:', fileContent);
//   } catch (error) {
//     console.error('Error reading file:', error);
//   }
// }


