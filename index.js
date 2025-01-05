// index.js
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const schedule = require('node-schedule');

const configPath = path.join(__dirname, 'config.json');
const sshKeyDir = path.join(__dirname, 'ssh_keys');
const sshKeyPath = path.join(sshKeyDir, 'id_rsa');
const sshKeyPubPath = path.join(sshKeyDir, 'id_rsa.pub');

// Load configuration
if (!fs.existsSync(configPath)) {
  console.error('Error: config.json not found. Please create one.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Validate configuration
if (!config.repo || !config.branch || !config.message || !config.pushDurationHours) {
  console.error('Error: Invalid configuration. Please check config.json.');
  process.exit(1);
}

const repoPath = path.resolve(config.repo);

if (!fs.existsSync(repoPath)) {
  console.error(`Error: Repository not found at ${repoPath}`);
  process.exit(1);
}

const pushDurationMs = config.pushDurationHours * 60 * 60 * 1000;
let lastPushTime = 0;

const generateSSHKey = () => {
  if (!fs.existsSync(sshKeyDir)) {
    fs.mkdirSync(sshKeyDir, { recursive: true });
  }

  const command = `ssh-keygen -t rsa -b 4096 -f ${sshKeyPath} -N \"\"`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Error generating SSH key:', error);
      process.exit(1);
    }
    console.log('SSH key generated successfully. Add the following public key to your GitHub account:');
    const publicKey = fs.readFileSync(sshKeyPubPath, 'utf-8');
    console.log(publicKey);
  });
};

if (!fs.existsSync(sshKeyPath) || !fs.existsSync(sshKeyPubPath)) {
  console.log('SSH key not found. Generating a new one...');
  generateSSHKey();
  console.log('Please add the generated public key to your GitHub account and restart the script.');
  process.exit(1);
}

const pushCode = () => {
  const currentTime = Date.now();
  if (currentTime - lastPushTime < pushDurationMs) {
    console.log('Skipping push: Push duration threshold not met.');
    return;
  }

  lastPushTime = currentTime;
  console.log('Starting code push...');

  const gitCommands = [
    `cd ${repoPath}`,
    `GIT_SSH_COMMAND=\"ssh -i ${sshKeyPath}\" git add .`,
    `GIT_SSH_COMMAND=\"ssh -i ${sshKeyPath}\" git commit -m \"${config.message}\"`,
    `GIT_SSH_COMMAND=\"ssh -i ${sshKeyPath}\" git push origin ${config.branch}`,
  ].join(' && ');

  exec(gitCommands, (error, stdout, stderr) => {
    if (error) {
      console.error('Error during git push:', error);
      return;
    }
    console.log('Git push successful:', stdout);
    if (stderr) console.error('Git push warnings:', stderr);
  });
};

// Schedule the task for every day at the specified time
schedule.scheduleJob(config.scheduleTime, pushCode);

console.log('Auto-push setup complete.');
