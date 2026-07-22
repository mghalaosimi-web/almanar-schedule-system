const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/generative-ai');

const PATCHES_FILE = path.join(__dirname, '../../data/pending_patches.json');

// Ensure data directory and JSON file exist
function initStorage() {
  const dir = path.dirname(PATCHES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(PATCHES_FILE)) {
    fs.writeFileSync(PATCHES_FILE, JSON.stringify([], null, 2));
  }
}

initStorage();

function loadPatches() {
  try {
    const content = fs.readFileSync(PATCHES_FILE, 'utf8');
    const patches = JSON.parse(content);
    
    // Resolve dynamic path adjustments for this local machine
    const rootPath = path.resolve(__dirname, '../..');
    return patches.map(patch => {
      if (patch.filePath && !fs.existsSync(patch.filePath)) {
        // e.g. path contains backend/src/...
        const match = patch.filePath.match(/[\\/]backend[\\/](src[\\/].*)$/i);
        if (match) {
          const adjusted = path.join(rootPath, match[1]);
          if (fs.existsSync(adjusted)) {
            patch.filePath = adjusted;
          }
        }
      }
      return patch;
    });
  } catch (err) {
    return [];
  }
}

function savePatches(patches) {
  try {
    fs.writeFileSync(PATCHES_FILE, JSON.stringify(patches, null, 2));
  } catch (err) {
    console.error('[PatcherService] Failed to write patches file:', err);
  }
}

/**
 * Clean path names from stack trace line.
 * Extracts the file path and line/column numbers.
 */
function parseErrorStack(stack) {
  if (!stack) return null;
  const lines = stack.split('\n');
  
  // Look for the first line that points to our backend files, excluding node_modules
  for (const line of lines) {
    if (line.includes('node_modules') || line.includes('internal/')) continue;
    
    // Match absolute paths in parenthesized expressions, or plain paths
    const match = line.match(/(?:at\s+.*?\s+\()?([a-zA-Z]:\\[^\s\)]+|[^\s\)]+):(\d+):(\d+)\)?/);
    if (match) {
      const filePath = match[1];
      const lineNo = parseInt(match[2]);
      const colNo = parseInt(match[3]);
      
      const backendRoot = path.resolve(__dirname, '../..');
      if (fs.existsSync(filePath)) {
        return { filePath, lineNo, colNo };
      }
      
      const relMatch = filePath.match(/[\\/]backend[\\/](src[\\/].*)$/i);
      if (relMatch) {
        const adjusted = path.join(backendRoot, relMatch[1]);
        if (fs.existsSync(adjusted)) {
          return { filePath: adjusted, lineNo, colNo };
        }
      }
    }
  }
  return null;
}

/**
 * Handle server error async. Called by middleware.
 */
async function handleServerError(err, req) {
  try {
    const errorLocation = parseErrorStack(err.stack);
    if (!errorLocation) {
      console.log('[PatcherService] Error stack trace did not point to local editable files.');
      return;
    }

    const { filePath, lineNo, colNo } = errorLocation;
    const fileContent = fs.readFileSync(filePath, 'utf8');

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    let aiResponse = null;

    if (apiKey) {
      try {
        console.log(`[PatcherService] Analysing error in ${path.basename(filePath)}:${lineNo} via Gemini...`);

        const ai = new GoogleGenAI({ apiKey });
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a Self-Healing developer assistant. An error occurred on a server route.
File of origin: ${filePath}
Line: ${lineNo}, Column: ${colNo}
Error: ${err.name} - ${err.message}
Stack Trace:
${err.stack}

HTTP Request Details:
Method: ${req.method}
Path: ${req.originalUrl}
Query: ${JSON.stringify(req.query)}
Body: ${JSON.stringify(req.body)}

Below is the full source code of the file where the error occurred:
--- START SOURCE CODE ---
${fileContent}
--- END SOURCE CODE ---

Analyze the error and propose a direct code fix (patch) for this file to resolve the exception/bug.
Format your response STRICTLY as a JSON object (no markdown formatting, no code block backticks like \`\`\`json). Follow this structure:
{
  "explanationAr": "شرح باللغة العربية للخطأ وكيفية إصلاحه وتلافيه.",
  "explanationEn": "Explanation in English of the bug and how it is fixed.",
  "proposedCode": "The ENTIRE new corrected source code for the file, complete and runnable. Make sure to keep all unmodified functions exactly as they were."
}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        
        // Clean up potential markdown formatting wrappers
        if (text.startsWith('```')) {
          text = text.replace(/```json|```/g, '').trim();
        }

        aiResponse = JSON.parse(text);
      } catch (aiErr) {
        console.warn('[PatcherService] Gemini call failed, falling back programmatically:', aiErr.message);
      }
    }

    if (!aiResponse) {
      console.log('[PatcherService] Executing programmatic self-healing fallback for error...');
      let proposedCode = fileContent;
      let explanationAr = 'تم تشغيل مصحح الأخطاء التلقائي الاحتياطي (دون استخدام Gemini API).';
      let explanationEn = 'Run-time fallback patcher executed programmatically (without Gemini API).';

      if (err.message && err.message.includes('TEST_ERROR')) {
        const lines = fileContent.split(/\r?\n/);
        const testErrorIndex = lines.findIndex(l => l.includes('TEST_ERROR'));
        if (testErrorIndex !== -1) {
          const indent = lines[testErrorIndex].match(/^\s*/)[0];
          lines[testErrorIndex] = `${indent}return res.status(200).json({ success: true, message: 'Test error resolved: Self-Healing Patcher is fully active and operational.' });`;
          proposedCode = lines.join('\n');
          explanationAr = 'تم التعرف على خطأ الاختبار التجريبي. يقترح هذا التعديل استبدال جملة الرمي (throw) بجملة إرجاع (return) آمنة بحالة 200 لمنع الانهيار.';
          explanationEn = 'Simulated test error detected. This proposed patch replaces the throwing expression with a safe HTTP 200 response to prevent system crash.';
        }
      } else {
        const lines = fileContent.split(/\r?\n/);
        if (lines.length >= lineNo) {
          const originalLine = lines[lineNo - 1];
          if (originalLine.includes('throw') || originalLine.includes('Error')) {
            lines[lineNo - 1] = `  // [AUTO-PATCH FALLBACK] Safely bypassed to avoid crash\n  console.warn('[PatcherService Fallback] Prevented crash on line ${lineNo}: ' + "${err.message}");\n  return res.status(500).json({ success: false, error: 'Self-healing bypassed this crash' });`;
            proposedCode = lines.join('\n');
            explanationAr = `تم رصد خطأ انهيار في السطر ${lineNo}. يقوم هذا التعديل التلقائي الاحتياطي بتعطيل السطر المعطوب وإرجاع رسالة تحذير آمنة لمنع السيرفر من الانهيار الكلي.`;
            explanationEn = `Crash detected on line ${lineNo}. This programmatic fallback disables the faulty line and returns a safe HTTP warning to prevent complete server crash.`;
          }
        }
      }

      aiResponse = { proposedCode, explanationAr, explanationEn };
    }

    if (!aiResponse.proposedCode) {
      throw new Error('Fallback response did not return proposedCode field.');
    }

    // Save as pending patch
    const patches = loadPatches();
    
    // Avoid duplicating the exact same error patch
    const exists = patches.find(p => p.filePath === filePath && p.errorMessage === err.message && p.status === 'PENDING');
    if (exists) {
      console.log('[PatcherService] A pending patch for this error already exists.');
      return;
    }

    const newPatch = {
      id: 'patch_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      filePath,
      fileBasename: path.basename(filePath),
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack,
      reqPath: req.originalUrl,
      reqMethod: req.method,
      originalCode: fileContent,
      proposedCode: aiResponse.proposedCode,
      explanationAr: aiResponse.explanationAr,
      explanationEn: aiResponse.explanationEn,
      status: 'PENDING'
    };

    patches.push(newPatch);
    savePatches(patches);
    console.log(`[PatcherService] Generated pending patch ${newPatch.id} successfully!`);
  } catch (error) {
    console.error('[PatcherService] Failed to generate AI self-healing patch:', error);
  }
}

/**
 * Get all patches
 */
function getPatches() {
  return loadPatches();
}

/**
 * Approve and apply code patch
 */
function approvePatch(id) {
  const patches = loadPatches();
  const index = patches.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error('Patch not found');
  }

  const patch = patches[index];
  if (patch.status !== 'PENDING') {
    throw new Error(`Patch is already ${patch.status}`);
  }

  // Resolve target file path robustly across environments
  let resolvedPath = patch.filePath;
  if (!fs.existsSync(resolvedPath)) {
    const rootPath = path.resolve(__dirname, '../..');
    const match = patch.filePath.match(/[\\/]backend[\\/](src[\\/].*)$/i) || patch.filePath.match(/src[\\/].*$/i);
    if (match) {
      const candidate = path.join(rootPath, match[1] || match[0]);
      if (fs.existsSync(candidate)) {
        resolvedPath = candidate;
      }
    }
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Target file does not exist at ${patch.filePath}`);
  }

  // Backup file before overwrite
  const backupPath = resolvedPath + '.bak';
  fs.copyFileSync(resolvedPath, backupPath);

  // Write new file content
  fs.writeFileSync(resolvedPath, patch.proposedCode, 'utf8');

  // Update status
  patch.status = 'APPROVED';
  patch.filePath = resolvedPath;
  patch.resolvedAt = new Date().toISOString();
  savePatches(patches);

  console.log(`[PatcherService] Applied patch ${id} to ${resolvedPath}. Backup saved to ${backupPath}`);
  
  // Return patch details
  return patch;
}

/**
 * Dismiss patch without applying
 */
function dismissPatch(id) {
  const patches = loadPatches();
  const index = patches.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error('Patch not found');
  }

  const patch = patches[index];
  patch.status = 'DISMISSED';
  patch.resolvedAt = new Date().toISOString();
  savePatches(patches);

  return patch;
}

module.exports = {
  handleServerError,
  getPatches,
  approvePatch,
  dismissPatch
};
