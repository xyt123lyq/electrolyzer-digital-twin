const fs = require('fs');
const logFile = "C:\\Users\\LYQDZH\\.gemini\\antigravity\\brain\\29c9fe9a-2455-49a4-b11a-1fd0a92571b3\\.system_generated\\logs\\transcript.jsonl";
const content = fs.readFileSync(logFile, 'utf-8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const obj = JSON.parse(lines[i]);
    if (obj.step_index >= 460 && obj.step_index <= 474) {
      console.log(`Step ${obj.step_index} (${obj.type}, source: ${obj.source}, status: ${obj.status}):`);
      if (obj.content) console.log("  Content:", obj.content.substring(0, 500));
      if (obj.error) console.log("  Error:", obj.error);
      console.log("------------------------");
    }
  } catch (e) {
    // ignore
  }
}
