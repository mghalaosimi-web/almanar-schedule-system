import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src', 'AdminDashboard.jsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const stack = [];
let inComment = false;
let inString = false;
let stringChar = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Ignore imports and single line comments for simplicity
  if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) continue;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    // Simple string detection
    if ((char === "'" || char === '"' || char === '`') && (j === 0 || line[j-1] !== '\\')) {
      if (inString && stringChar === char) {
        inString = false;
      } else if (!inString) {
        inString = true;
        stringChar = char;
      }
    }
    
    if (inString) continue;
    
    // Simple comment detection
    if (char === '/' && line[j+1] === '/') {
      break; // Rest of the line is a comment
    }
    
    if (char === '{') {
      stack.push({ char, line: i + 1, col: j + 1 });
    } else if (char === '}') {
      if (stack.length === 0) {
        console.log(`Extra '}' found at Line ${i + 1}, Col ${j + 1}`);
      } else {
        const top = stack.pop();
        if (top.char !== '{') {
          console.log(`Mismatched '}' for '${top.char}' opened at Line ${top.line}, Col ${top.col} - Found at Line ${i + 1}, Col ${j + 1}`);
        }
      }
    } else if (char === '(') {
      stack.push({ char, line: i + 1, col: j + 1 });
    } else if (char === ')') {
      if (stack.length === 0) {
        console.log(`Extra ')' found at Line ${i + 1}, Col ${j + 1}`);
      } else {
        const top = stack.pop();
        if (top.char !== '(') {
          console.log(`Mismatched ')' for '${top.char}' opened at Line ${top.line}, Col ${top.col} - Found at Line ${i + 1}, Col ${j + 1}`);
        }
      }
    }
  }
}

if (stack.length > 0) {
  console.log(`\nUnclosed tokens remaining: ${stack.length}`);
  stack.forEach(token => {
    console.log(`Unclosed '${token.char}' opened at Line ${token.line}, Col ${token.col}`);
  });
} else {
  console.log("All braces and parentheses are balanced!");
}
