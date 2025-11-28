function parseChoices(rawString) {
  // Split into lines, trim whitespace, remove empty lines
  const lines = rawString
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const result = [];
  let currentKey = null;
  let currentValue = [];

  for (const line of lines) {
    // Match patterns like: A. text...
    const match = line.match(/^([A-Za-z])\.\s*(.*)$/);

    if (match) {
      // If we were collecting previous key-value, push it
      if (currentKey) {
        result.push({
          key: currentKey,
          value: currentValue.join(' ').trim()
        });
      }

      // Start new key/value
      currentKey = match[1];
      currentValue = [match[2] || ''];  
    } else {
      // Continuation of previous value
      currentValue.push(line);
    }
  }

  // Push last block
  if (currentKey) {
    result.push({
      key: currentKey,
      value: currentValue.join(' ').trim()
    });
  }

  return result;
}
module.exports = parseChoices;