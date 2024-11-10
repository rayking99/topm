#!/usr/bin/env node

import { $ } from 'zx';
$.verbose = false; // Add this line after the import
import readline from 'readline';
import os from 'os';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Existing helper functions
const formatMemory = (memBytes) => {
  return (memBytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const generateBar = (value, max, length) => {
  const filledLength = Math.round((value / max) * length);
  const emptyLength = length - filledLength;
  const gradient = value/max > 0.7 ? colors.red : value/max > 0.4 ? colors.yellow : colors.green;
  return gradient + '█'.repeat(filledLength) + colors.dim + '░'.repeat(emptyLength) + colors.reset;
};

// Get system info
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedMem = totalMem - freeMem;

// Fetch and process memory usage (existing code remains the same until sorting)
let psOutput;
try {
  // Redirect stderr to /dev/null to suppress any messages
  psOutput = await $`ps -axo rss,comm 2>/dev/null`;
} catch (error) {
  console.error('Error fetching process list:', error);
  process.exit(1);
}

// Parse the output
const lines = psOutput.stdout.trim().split('\n');
// Remove the header
lines.shift();

const processList = lines.map(line => {
  const match = line.trim().match(/^(\d+)\s+(.*)$/);
  if (match) {
    return {
      memory: parseInt(match[1], 10), // in KB
      name: match[2],
    };
  }
  return null;
}).filter(item => item !== null);

// Aggregate memory usage by process name
const memoryMap = {};
processList.forEach(proc => {
  if (proc.memory) { // Ensure memory value is valid
    if (memoryMap[proc.name]) {
      memoryMap[proc.name] += proc.memory;
    } else {
      memoryMap[proc.name] = proc.memory;
    }
  }
});

// Convert to array and sort by memory usage descending
const sortedProcesses = Object.entries(memoryMap)
  .map(([name, memory]) => ({ name, memory }))
  .sort((a, b) => b.memory - a.memory)
  .slice(0, 20); // Top 20 processes

// Find the maximum memory for scaling the bars
const maxMemory = sortedProcesses[0]?.memory || 1;

// Get terminal width
const terminalWidth = process.stdout.columns || 80;

// Define fixed widths for memory and spacing
const memoryWidth = 10; // e.g., "999.99 MB"
const spacing = 5;
const nameWidth = 40;

// Calculate bar length
const barLength = terminalWidth - memoryWidth - nameWidth - spacing - 2;
const adjustedBarLength = barLength > 10 ? barLength : 10;

// Function to smartly truncate the path
const smartTruncatePath = (path, maxLength) => {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  let truncated = parts[0];
  for (let i = 1; i < parts.length; i++) {
    truncated += '/...' + '/' + parts.slice(-1)[0];
    if (truncated.length > maxLength) {
      return truncated.substring(0, maxLength - 3) + '...';
    }
  }
  return truncated;
};

// Calculate total memory of listed processes
const totalProcessMem = Object.values(memoryMap).reduce((sum, mem) => sum + mem, 0);

// Clear screen and show header
console.clear();
console.log('\n' + colors.bright + colors.cyan + '╭─────────── System Memory Usage ───────────╮' + colors.reset);
console.log(colors.cyan + '│' + colors.reset + ` Total Memory: ${colors.bright}${formatMemory(totalMem)}${colors.reset}`);
console.log(colors.cyan + '│' + colors.reset + ` Used Memory:  ${colors.yellow}${formatMemory(usedMem)}${colors.reset} (${(usedMem/totalMem*100).toFixed(1)}%)`);
console.log(colors.cyan + '│' + colors.reset + ` Free Memory:  ${colors.green}${formatMemory(freeMem)}${colors.reset}`);
console.log(colors.cyan + '╰───────────────────────────────────────────╯\n' + colors.reset);

// Display the memory usage bar chart
console.log(colors.bright + colors.blue + '=== Top Processes by Memory Usage ===' + colors.reset);
sortedProcesses.forEach(proc => {
  const bar = generateBar(proc.memory, maxMemory, adjustedBarLength);
  const memStr = formatMemory(proc.memory * 1024).padStart(memoryWidth);
  const availableNameWidth = terminalWidth - memoryWidth - adjustedBarLength - spacing - 2;
  const truncatedName = smartTruncatePath(proc.name, availableNameWidth);
  console.log(`${bar} ${colors.bright}${memStr}${colors.reset} ${colors.dim}${truncatedName}${colors.reset}`);
});