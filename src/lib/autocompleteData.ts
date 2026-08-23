export interface CommandDef {
  command: string;
  description: string;
  category: CommandCategory;
  flags?: string[];
  aliases?: string[];
  contextDirs?: string[];
}

export type CommandCategory =
  | 'System'
  | 'File Operations'
  | 'Text Processing'
  | 'Network'
  | 'Process'
  | 'Docker'
  | 'Git'
  | 'Kubernetes'
  | 'Systemctl'
  | 'Package Manager'
  | 'Permissions'
  | 'Disk'
  | 'Archive'
  | 'SSH'
  | 'Monitoring'
  | 'User'
  | 'Search';

const CATEGORY_ORDER: CommandCategory[] = [
  'System',
  'File Operations',
  'Text Processing',
  'Network',
  'Process',
  'Docker',
  'Git',
  'Kubernetes',
  'Systemctl',
  'Package Manager',
  'Permissions',
  'Disk',
  'Archive',
  'SSH',
  'Monitoring',
  'User',
  'Search',
];

export const CATEGORY_COLORS: Record<CommandCategory, string> = {
  System: '#60a5fa',
  'File Operations': '#34d399',
  'Text Processing': '#a78bfa',
  Network: '#f472b6',
  Process: '#fb923c',
  Docker: '#38bdf8',
  Git: '#f87171',
  Kubernetes: '#c084fc',
  Systemctl: '#4ade80',
  'Package Manager': '#fbbf24',
  Permissions: '#f97316',
  Disk: '#2dd4bf',
  Archive: '#e879f9',
  SSH: '#67e8f9',
  Monitoring: '#a3e635',
  User: '#fb7185',
  Search: '#94a3b8',
};

export const CATEGORY_ICONS: Record<CommandCategory, string> = {
  System: '🖥',
  'File Operations': '📁',
  'Text Processing': '📝',
  Network: '🌐',
  Process: '⚡',
  Docker: '🐳',
  Git: '🔀',
  Kubernetes: '☸',
  Systemctl: '🔧',
  'Package Manager': '📦',
  Permissions: '🔐',
  Disk: '💾',
  Archive: '📦',
  SSH: '🔑',
  Monitoring: '📊',
  User: '👤',
  Search: '🔍',
};

export const commandDatabase: CommandDef[] = [
  // System
  { command: 'uname', description: 'Print system information', category: 'System', flags: ['-a', '-r', '-n', '-m'] },
  { command: 'uname -a', description: 'Print all system information', category: 'System' },
  { command: 'uptime', description: 'Show system uptime and load', category: 'System' },
  { command: 'hostname', description: 'Show or set hostname', category: 'System' },
  { command: 'reboot', description: 'Restart the system', category: 'System' },
  { command: 'shutdown', description: 'Shut down the system', category: 'System', flags: ['-h', '-r', '-c'] },
  { command: 'poweroff', description: 'Power off the system', category: 'System' },
  { command: 'dmesg', description: 'Print kernel ring buffer', category: 'System', flags: ['-T', '-w'] },
  { command: 'lsb_release', description: 'Show Linux distribution info', category: 'System', flags: ['-a'] },
  { command: 'cat /etc/os-release', description: 'Show OS release information', category: 'System' },
  { command: 'timedatectl', description: 'Query/change system time and date', category: 'System' },
  { command: 'timersstatus', description: 'List systemd timers', category: 'System' },

  // File Operations
  { command: 'ls', description: 'List directory contents', category: 'File Operations', flags: ['-la', '-lh', '-ltr', '-lS', '--color'] },
  { command: 'cd', description: 'Change directory', category: 'File Operations' },
  { command: 'pwd', description: 'Print working directory', category: 'File Operations' },
  { command: 'cp', description: 'Copy files or directories', category: 'File Operations', flags: ['-r', '-a', '-v', '-i'] },
  { command: 'mv', description: 'Move or rename files', category: 'File Operations', flags: ['-v', '-i', '-n'] },
  { command: 'rm', description: 'Remove files or directories', category: 'File Operations', flags: ['-rf', '-r', '-i', '-v', '-f'] },
  { command: 'mkdir', description: 'Create directories', category: 'File Operations', flags: ['-p', '-v'] },
  { command: 'rmdir', description: 'Remove empty directories', category: 'File Operations' },
  { command: 'touch', description: 'Create empty file or update timestamp', category: 'File Operations' },
  { command: 'cat', description: 'Display file contents', category: 'File Operations' },
  { command: 'less', description: 'View file contents with paging', category: 'File Operations' },
  { command: 'more', description: 'View file contents page by page', category: 'File Operations' },
  { command: 'head', description: 'Show first lines of file', category: 'File Operations', flags: ['-n', '-c'] },
  { command: 'tail', description: 'Show last lines of file', category: 'File Operations', flags: ['-f', '-n', '-c'] },
  { command: 'tail -f', description: 'Follow file output in real time', category: 'File Operations' },
  { command: 'nano', description: 'Simple terminal text editor', category: 'File Operations' },
  { command: 'vim', description: 'Vi text editor', category: 'File Operations' },
  { command: 'vi', description: 'Vi text editor', category: 'File Operations' },
  { command: 'emacs', description: 'GNU Emacs text editor', category: 'File Operations' },
  { command: 'tee', description: 'Read from stdin and write to files', category: 'File Operations', flags: ['-a'] },
  { command: 'ln', description: 'Create links between files', category: 'File Operations', flags: ['-s', '-f'] },
  { command: 'readlink', description: 'Print resolved symbolic links', category: 'File Operations', flags: ['-f'] },
  { command: 'realpath', description: 'Print resolved file path', category: 'File Operations' },
  { command: 'stat', description: 'Display file or filesystem status', category: 'File Operations' },
  { command: 'file', description: 'Determine file type', category: 'File Operations' },
  { command: 'basename', description: 'Strip directory from filename', category: 'File Operations' },
  { command: 'dirname', description: 'Strip filename from path', category: 'File Operations' },
  { command: 'wc', description: 'Word, line, character count', category: 'File Operations', flags: ['-l', '-w', '-c'] },
  { command: 'xargs', description: 'Build command lines from stdin', category: 'File Operations', flags: ['-n', '-P'] },

  // Text Processing
  { command: 'grep', description: 'Search text patterns in files', category: 'Text Processing', flags: ['-r', '-i', '-n', '-l', '-v', '-c', '-E', '-A', '-B'] },
  { command: 'rg', description: 'Fast recursive grep (ripgrep)', category: 'Text Processing', flags: ['-i', '-n', '-l', '-v', '-c'] },
  { command: 'sed', description: 'Stream editor for text transformation', category: 'Text Processing', flags: ['-i', '-e', '-n'] },
  { command: 'awk', description: 'Text processing and data extraction', category: 'Text Processing' },
  { command: 'cut', description: 'Remove sections from lines', category: 'Text Processing', flags: ['-d', '-f', '-c'] },
  { command: 'sort', description: 'Sort lines of text', category: 'Text Processing', flags: ['-n', '-r', '-u', '-k', '-t'] },
  { command: 'uniq', description: 'Filter repeated lines', category: 'Text Processing', flags: ['-c', '-d', '-u'] },
  { command: 'tr', description: 'Translate or delete characters', category: 'Text Processing', flags: ['-d', '-s'] },
  { command: 'diff', description: 'Compare files line by line', category: 'Text Processing', flags: ['-u', '-r', '-y'] },
  { command: 'comm', description: 'Compare sorted files column-wise', category: 'Text Processing' },
  { command: 'column', description: 'Format input into columns', category: 'Text Processing', flags: ['-t', '-s'] },
  { command: 'paste', description: 'Merge lines of files', category: 'Text Processing', flags: ['-d', '-s'] },
  { command: 'fmt', description: 'Simple text formatter', category: 'Text Processing', flags: ['-w'] },

  // Network
  { command: 'ping', description: 'Test network connectivity', category: 'Network', flags: ['-c', '-i', '-s', '-t'] },
  { command: 'curl', description: 'Transfer data with URLs', category: 'Network', flags: ['-I', '-X', '-d', '-H', '-o', '-v', '-s', '-L', '-k'] },
  { command: 'wget', description: 'Download files from web', category: 'Network', flags: ['-O', '-q', '-c', '-r'] },
  { command: 'ifconfig', description: 'Configure network interfaces', category: 'Network' },
  { command: 'ip', description: 'Show/manipulate routing and interfaces', category: 'Network', flags: ['addr', 'link', 'route', 'a'] },
  { command: 'ip addr', description: 'Show IP addresses', category: 'Network' },
  { command: 'ip link', description: 'Show network interfaces', category: 'Network' },
  { command: 'ip route', description: 'Show routing table', category: 'Network' },
  { command: 'netstat', description: 'Show network statistics', category: 'Network', flags: ['-tulpn', '-an', '-r'] },
  { command: 'ss', description: 'Socket statistics', category: 'Network', flags: ['-tulpn', '-an', '-s'] },
  { command: 'nslookup', description: 'Query DNS records', category: 'Network' },
  { command: 'dig', description: 'DNS lookup utility', category: 'Network', flags: ['-x', '+short', '+trace'] },
  { command: 'host', description: 'DNS lookup utility', category: 'Network' },
  { command: 'traceroute', description: 'Trace route to host', category: 'Network', flags: ['-n'] },
  { command: 'mtr', description: 'Network diagnostic tool', category: 'Network', flags: ['-n', '-c'] },
  { command: 'nc', description: 'Netcat - TCP/UDP connections', category: 'Network', flags: ['-z', '-v', '-l', '-p'] },
  { command: 'nmap', description: 'Network port scanner', category: 'Network', flags: ['-sV', '-sS', '-p', '-O'] },
  { command: 'arp', description: 'Address resolution table', category: 'Network', flags: ['-a'] },
  { command: 'iptables', description: 'Firewall rules', category: 'Network', flags: ['-L', '-A', '-D', '-F'] },
  { command: 'ufw', description: 'Uncomplicated firewall', category: 'Network', flags: ['enable', 'disable', 'allow', 'deny', 'status'] },
  { command: 'firewall-cmd', description: 'Firewall management', category: 'Network', flags: ['--state', '--list-all', '--add-port'] },
  { command: 'ip neigh', description: 'Show ARP neighbor table', category: 'Network' },

  // Process
  { command: 'ps', description: 'List running processes', category: 'Process', flags: ['aux', 'ef', '-ef', 'ax'] },
  { command: 'top', description: 'Monitor system processes', category: 'Process' },
  { command: 'htop', description: 'Interactive process viewer', category: 'Process' },
  { command: 'kill', description: 'Terminate processes by PID', category: 'Process', flags: ['-9', '-15', '-SIGTERM', '-SIGHUP'] },
  { command: 'killall', description: 'Kill processes by name', category: 'Process', flags: ['-9'] },
  { command: 'pkill', description: 'Kill processes matching pattern', category: 'Process', flags: ['-f', '-9'] },
  { command: 'pgrep', description: 'Find processes by name', category: 'Process', flags: ['-f', '-l'] },
  { command: 'nohup', description: 'Run command ignoring hangups', category: 'Process' },
  { command: 'nice', description: 'Run with modified priority', category: 'Process', flags: ['-n'] },
  { command: 'renice', description: 'Change process priority', category: 'Process', flags: ['-n'] },
  { command: 'bg', description: 'Resume job in background', category: 'Process' },
  { command: 'fg', description: 'Bring job to foreground', category: 'Process' },
  { command: 'jobs', description: 'List background jobs', category: 'Process' },
  { command: 'wait', description: 'Wait for background process', category: 'Process' },
  { command: 'lsof', description: 'List open files', category: 'Process', flags: ['-i', '-p', '-n'] },
  { command: 'strace', description: 'Trace system calls', category: 'Process', flags: ['-p', '-e', '-f', '-o'] },
  { command: 'ltrace', description: 'Trace library calls', category: 'Process' },
  { command: 'free', description: 'Show memory usage', category: 'Process', flags: ['-h', '-m', '-g'] },
  { command: 'vmstat', description: 'Virtual memory statistics', category: 'Process', flags: ['1', '5'] },
  { command: 'mpstat', description: 'Processor statistics', category: 'Process' },
  { command: 'iostat', description: 'I/O statistics', category: 'Process', flags: ['-x', '1'] },

  // Docker
  { command: 'docker', description: 'Container management', category: 'Docker' },
  { command: 'docker ps', description: 'List running containers', category: 'Docker', flags: ['-a', '--format', '-q'] },
  { command: 'docker run', description: 'Run container from image', category: 'Docker', flags: ['-d', '-it', '-p', '-v', '-e', '--name', '--rm', '--network'] },
  { command: 'docker stop', description: 'Stop running container', category: 'Docker' },
  { command: 'docker start', description: 'Start stopped container', category: 'Docker' },
  { command: 'docker restart', description: 'Restart container', category: 'Docker' },
  { command: 'docker rm', description: 'Remove container', category: 'Docker', flags: ['-f'] },
  { command: 'docker exec', description: 'Execute command in container', category: 'Docker', flags: ['-it'] },
  { command: 'docker logs', description: 'View container logs', category: 'Docker', flags: ['-f', '-t', '--tail'] },
  { command: 'docker build', description: 'Build image from Dockerfile', category: 'Docker', flags: ['-t', '--no-cache', '-f'] },
  { command: 'docker images', description: 'List Docker images', category: 'Docker', flags: ['-a', '-q'] },
  { command: 'docker rmi', description: 'Remove Docker image', category: 'Docker' },
  { command: 'docker pull', description: 'Pull image from registry', category: 'Docker' },
  { command: 'docker push', description: 'Push image to registry', category: 'Docker' },
  { command: 'docker tag', description: 'Create image tag', category: 'Docker' },
  { command: 'docker inspect', description: 'Display container/image details', category: 'Docker' },
  { command: 'docker network ls', description: 'List Docker networks', category: 'Docker' },
  { command: 'docker volume ls', description: 'List Docker volumes', category: 'Docker' },
  { command: 'docker system df', description: 'Show Docker disk usage', category: 'Docker' },
  { command: 'docker system prune', description: 'Remove unused Docker data', category: 'Docker', flags: ['-a', '--volumes'] },
  { command: 'docker compose', description: 'Docker Compose management', category: 'Docker' },
  { command: 'docker compose up', description: 'Start compose services', category: 'Docker', flags: ['-d', '--build', '--force-recreate'] },
  { command: 'docker compose down', description: 'Stop and remove compose services', category: 'Docker' },
  { command: 'docker compose ps', description: 'List compose services', category: 'Docker' },
  { command: 'docker compose logs', description: 'View compose service logs', category: 'Docker', flags: ['-f', '--tail'] },
  { command: 'docker compose restart', description: 'Restart compose services', category: 'Docker' },

  // Git
  { command: 'git', description: 'Version control system', category: 'Git' },
  { command: 'git init', description: 'Initialize a Git repository', category: 'Git' },
  { command: 'git clone', description: 'Clone a repository', category: 'Git' },
  { command: 'git add', description: 'Stage files for commit', category: 'Git', flags: ['-A', '.', '-p'] },
  { command: 'git commit', description: 'Commit staged changes', category: 'Git', flags: ['-m', '-a', '--amend'] },
  { command: 'git push', description: 'Push commits to remote', category: 'Git', flags: ['-u', '--force', '--force-with-lease'] },
  { command: 'git pull', description: 'Pull changes from remote', category: 'Git', flags: ['--rebase', '--ff-only'] },
  { command: 'git fetch', description: 'Download remote changes', category: 'Git' },
  { command: 'git branch', description: 'List/create/delete branches', category: 'Git', flags: ['-a', '-d', '-D', '-m'] },
  { command: 'git checkout', description: 'Switch branches or restore files', category: 'Git', flags: ['-b'] },
  { command: 'git switch', description: 'Switch branches', category: 'Git', flags: ['-c'] },
  { command: 'git merge', description: 'Merge branches', category: 'Git' },
  { command: 'git rebase', description: 'Rebase current branch', category: 'Git', flags: ['-i'] },
  { command: 'git status', description: 'Show working tree status', category: 'Git' },
  { command: 'git diff', description: 'Show file changes', category: 'Git', flags: ['--staged', '--cached', 'HEAD'] },
  { command: 'git log', description: 'Show commit history', category: 'Git', flags: ['--oneline', '-10', '--graph', '--stat', '-p'] },
  { command: 'git show', description: 'Show commit details', category: 'Git' },
  { command: 'git stash', description: 'Stash working changes', category: 'Git', flags: ['push', 'pop', 'list', 'drop'] },
  { command: 'git remote', description: 'Manage remote repositories', category: 'Git', flags: ['-v', 'add', 'remove'] },
  { command: 'git tag', description: 'List/create tags', category: 'Git', flags: ['-a', '-d'] },
  { command: 'git reset', description: 'Reset current HEAD', category: 'Git', flags: ['--soft', '--hard', '--mixed'] },
  { command: 'git revert', description: 'Create commit reversing changes', category: 'Git' },
  { command: 'git cherry-pick', description: 'Apply a specific commit', category: 'Git' },
  { command: 'git blame', description: 'Show line-by-line revision info', category: 'Git' },
  { command: 'git reflog', description: 'Show reference log', category: 'Git' },
  { command: 'git config', description: 'Get/set Git configuration', category: 'Git', flags: ['--global', '--list'] },
  { command: 'git clean', description: 'Remove untracked files', category: 'Git', flags: ['-fd', '-n'] },
  { command: 'git submodule', description: 'Manage submodules', category: 'Git', flags: ['update', 'init', 'status'] },

  // Kubernetes
  { command: 'kubectl', description: 'Kubernetes CLI', category: 'Kubernetes' },
  { command: 'kubectl get', description: 'List Kubernetes resources', category: 'Kubernetes', flags: ['-o', '-n', '-A', '-w'] },
  { command: 'kubectl get pods', description: 'List pods', category: 'Kubernetes', flags: ['-A', '-o wide'] },
  { command: 'kubectl get svc', description: 'List services', category: 'Kubernetes' },
  { command: 'kubectl get nodes', description: 'List cluster nodes', category: 'Kubernetes' },
  { command: 'kubectl describe', description: 'Describe Kubernetes resource', category: 'Kubernetes' },
  { command: 'kubectl apply', description: 'Apply configuration to resource', category: 'Kubernetes', flags: ['-f'] },
  { command: 'kubectl delete', description: 'Delete Kubernetes resources', category: 'Kubernetes', flags: ['-f', '--grace-period'] },
  { command: 'kubectl logs', description: 'View pod logs', category: 'Kubernetes', flags: ['-f', '--tail', '-c', '--previous'] },
  { command: 'kubectl exec', description: 'Execute command in pod', category: 'Kubernetes', flags: ['-it', '-c'] },
  { command: 'kubectl create', description: 'Create Kubernetes resource', category: 'Kubernetes' },
  { command: 'kubectl rollout', description: 'Manage deployment rollouts', category: 'Kubernetes', flags: ['status', 'undo', 'history'] },
  { command: 'kubectl scale', description: 'Scale a resource', category: 'Kubernetes', flags: ['--replicas'] },
  { command: 'kubectl config', description: 'Manage kubeconfig', category: 'Kubernetes', flags: ['get-contexts', 'use-context', 'current-context'] },
  { command: 'kubectl port-forward', description: 'Forward local port to pod', category: 'Kubernetes' },
  { command: 'kubectl top', description: 'Resource usage metrics', category: 'Kubernetes', flags: ['pods', 'nodes'] },

  // Systemctl
  { command: 'systemctl start', description: 'Start a systemd service', category: 'Systemctl' },
  { command: 'systemctl stop', description: 'Stop a systemd service', category: 'Systemctl' },
  { command: 'systemctl restart', description: 'Restart a systemd service', category: 'Systemctl' },
  { command: 'systemctl reload', description: 'Reload a systemd service', category: 'Systemctl' },
  { command: 'systemctl status', description: 'Show systemd service status', category: 'Systemctl' },
  { command: 'systemctl enable', description: 'Enable systemd service at boot', category: 'Systemctl' },
  { command: 'systemctl disable', description: 'Disable systemd service at boot', category: 'Systemctl' },
  { command: 'systemctl is-active', description: 'Check if service is active', category: 'Systemctl' },
  { command: 'systemctl list-units', description: 'List systemd units', category: 'Systemctl', flags: ['--type=service', '--state=running'] },
  { command: 'systemctl list-unit-files', description: 'List unit files', category: 'Systemctl' },
  { command: 'systemctl daemon-reload', description: 'Reload systemd daemon', category: 'Systemctl' },
  { command: 'systemctl mask', description: 'Prevent service from starting', category: 'Systemctl' },
  { command: 'systemctl unmask', description: 'Allow service to start', category: 'Systemctl' },
  { command: 'journalctl', description: 'View systemd journal logs', category: 'Systemctl', flags: ['-f', '-u', '-e', '--no-pager', '-n'] },
  { command: 'journalctl -f', description: 'Follow journal in real time', category: 'Systemctl' },
  { command: 'journalctl -u', description: 'Logs for specific unit', category: 'Systemctl' },
  { command: 'service', description: 'Run SysV init scripts', category: 'Systemctl' },

  // Package Manager
  { command: 'apt update', description: 'Update apt package list', category: 'Package Manager' },
  { command: 'apt upgrade', description: 'Upgrade installed packages', category: 'Package Manager' },
  { command: 'apt install', description: 'Install a package', category: 'Package Manager' },
  { command: 'apt remove', description: 'Remove a package', category: 'Package Manager' },
  { command: 'apt search', description: 'Search for a package', category: 'Package Manager' },
  { command: 'apt list', description: 'List packages', category: 'Package Manager', flags: ['--installed', '--upgradable'] },
  { command: 'apt autoremove', description: 'Remove unused dependencies', category: 'Package Manager' },
  { command: 'yum install', description: 'Install a package (RHEL)', category: 'Package Manager' },
  { command: 'yum remove', description: 'Remove a package (RHEL)', category: 'Package Manager' },
  { command: 'yum update', description: 'Update packages (RHEL)', category: 'Package Manager' },
  { command: 'dnf install', description: 'Install a package (Fedora)', category: 'Package Manager' },
  { command: 'dnf remove', description: 'Remove a package (Fedora)', category: 'Package Manager' },
  { command: 'npm install', description: 'Install Node.js packages', category: 'Package Manager', flags: ['-g', '--save-dev', '--legacy-peer-deps'] },
  { command: 'npm run', description: 'Run npm script', category: 'Package Manager' },
  { command: 'npm update', description: 'Update Node.js packages', category: 'Package Manager' },
  { command: 'yarn install', description: 'Install packages with Yarn', category: 'Package Manager' },
  { command: 'pip install', description: 'Install Python packages', category: 'Package Manager', flags: ['-r', '--user', '--upgrade'] },
  { command: 'pip uninstall', description: 'Remove Python packages', category: 'Package Manager' },
  { command: 'pip list', description: 'List installed Python packages', category: 'Package Manager' },
  { command: 'pip freeze', description: 'List packages as requirements', category: 'Package Manager' },

  // Permissions
  { command: 'chmod', description: 'Change file permissions', category: 'Permissions', flags: ['-R', '-v'] },
  { command: 'chown', description: 'Change file owner', category: 'Permissions', flags: ['-R', '-v'] },
  { command: 'chgrp', description: 'Change file group', category: 'Permissions' },
  { command: 'sudo', description: 'Execute as superuser', category: 'Permissions', flags: ['-u', '-E', '-S', '-i'] },
  { command: 'su', description: 'Switch user', category: 'Permissions', flags: ['-l', '-s'] },
  { command: 'passwd', description: 'Change user password', category: 'Permissions' },
  { command: 'umask', description: 'Set file creation mask', category: 'Permissions' },

  // Disk
  { command: 'df', description: 'Show disk space usage', category: 'Disk', flags: ['-h', '-T', '-i'] },
  { command: 'du', description: 'Show directory space usage', category: 'Disk', flags: ['-h', '--max-depth', '-s'] },
  { command: 'mount', description: 'Mount filesystem', category: 'Disk' },
  { command: 'umount', description: 'Unmount filesystem', category: 'Disk' },
  { command: 'fdisk', description: 'Partition table manipulator', category: 'Disk', flags: ['-l'] },
  { command: 'lsblk', description: 'List block devices', category: 'Disk' },
  { command: 'blkid', description: 'Block device attributes', category: 'Disk' },
  { command: 'fsck', description: 'Filesystem consistency check', category: 'Disk' },
  { command: 'resize2fs', description: 'Resize ext2/ext3/ext4 filesystem', category: 'Disk' },
  { command: 'lvm', description: 'Logical Volume Manager', category: 'Disk' },
  { command: 'pvcreate', description: 'Create physical volume', category: 'Disk' },
  { command: 'vgcreate', description: 'Create volume group', category: 'Disk' },
  { command: 'lvcreate', description: 'Create logical volume', category: 'Disk' },
  { command: 'fstrim', description: 'Discard unused blocks', category: 'Disk', flags: ['-av'] },

  // Archive
  { command: 'tar', description: 'Archive files', category: 'Archive', flags: ['-xzf', '-czf', '-tf', '-xf', '-cjf'] },
  { command: 'zip', description: 'Create ZIP archives', category: 'Archive', flags: ['-r'] },
  { command: 'unzip', description: 'Extract ZIP archives', category: 'Archive', flags: ['-l', '-d'] },
  { command: 'gzip', description: 'Compress files with gzip', category: 'Archive', flags: ['-d', '-k'] },
  { command: 'gunzip', description: 'Decompress gzip files', category: 'Archive' },
  { command: 'bzip2', description: 'Compress files with bzip2', category: 'Archive' },
  { command: 'xz', description: 'Compress files with xz', category: 'Archive' },
  { command: 'zcat', description: 'View gzipped file contents', category: 'Archive' },

  // SSH
  { command: 'ssh', description: 'Secure shell connection', category: 'SSH', flags: ['-p', '-i', '-L', '-R', '-N', '-f'] },
  { command: 'scp', description: 'Secure copy over SSH', category: 'SSH', flags: ['-r', '-P'] },
  { command: 'rsync', description: 'Remote sync utility', category: 'SSH', flags: ['-avz', '-av', '--delete', '--progress'] },
  { command: 'ssh-keygen', description: 'Generate SSH key pair', category: 'SSH', flags: ['-t', '-b', '-f'] },
  { command: 'ssh-keyscan', description: 'Gather SSH host keys', category: 'SSH' },
  { command: 'ssh-copy-id', description: 'Install SSH key on remote', category: 'SSH' },
  { command: 'ssh-agent', description: 'Manage SSH agent', category: 'SSH' },
  { command: 'ssh-add', description: 'Add key to SSH agent', category: 'SSH' },
  { command: 'sshfs', description: 'Mount remote filesystem via SSH', category: 'SSH' },

  // Monitoring
  { command: 'top', description: 'Monitor system processes', category: 'Monitoring' },
  { command: 'htop', description: 'Interactive process viewer', category: 'Monitoring' },
  { command: 'nmon', description: 'System performance monitor', category: 'Monitoring' },
  { command: 'atop', description: 'Advanced system monitor', category: 'Monitoring' },
  { command: 'sar', description: 'System activity reporter', category: 'Monitoring', flags: ['-u', '-r', '-d'] },
  { command: 'iostat', description: 'I/O statistics', category: 'Monitoring' },
  { command: 'iotop', description: 'I/O usage by process', category: 'Monitoring' },
  { command: 'ifstat', description: 'Interface statistics', category: 'Monitoring' },
  { command: 'nethogs', description: 'Network traffic per process', category: 'Monitoring' },
  { command: 'glances', description: 'System monitoring tool', category: 'Monitoring' },
  { command: 'dstat', description: 'Versatile resource statistics', category: 'Monitoring' },
  { command: 'uptime', description: 'Show uptime and load average', category: 'Monitoring' },
  { command: 'watch', description: 'Repeat command periodically', category: 'Monitoring', flags: ['-n'] },

  // User
  { command: 'whoami', description: 'Print current username', category: 'User' },
  { command: 'id', description: 'Print user/group IDs', category: 'User' },
  { command: 'who', description: 'Show logged-in users', category: 'User' },
  { command: 'w', description: 'Show who is logged in', category: 'User' },
  { command: 'last', description: 'Show login history', category: 'User' },
  { command: 'lastb', description: 'Show failed login attempts', category: 'User' },
  { command: 'useradd', description: 'Create a new user', category: 'User', flags: ['-m', '-s', '-g'] },
  { command: 'usermod', description: 'Modify a user account', category: 'User', flags: ['-aG', '-s', '-d'] },
  { command: 'userdel', description: 'Delete a user account', category: 'User', flags: ['-r'] },
  { command: 'groupadd', description: 'Create a new group', category: 'User' },
  { command: 'groups', description: 'Print user groups', category: 'User' },
  { command: 'env', description: 'Print environment variables', category: 'User' },
  { command: 'export', description: 'Set environment variable', category: 'User' },
  { command: 'alias', description: 'Create command alias', category: 'User' },
  { command: 'crontab', description: 'Edit cron jobs', category: 'User', flags: ['-e', '-l'] },
  { command: 'at', description: 'Schedule one-time task', category: 'User' },

  // Search
  { command: 'find', description: 'Search for files recursively', category: 'Search', flags: ['-name', '-type', '-mtime', '-size', '-exec', '-perm'] },
  { command: 'locate', description: 'Find files by name (database)', category: 'Search' },
  { command: 'updatedb', description: 'Update locate database', category: 'Search' },
  { command: 'which', description: 'Locate a command', category: 'Search' },
  { command: 'whereis', description: 'Locate binary/source/man', category: 'Search' },
  { command: 'type', description: 'Identify command type', category: 'Search' },
  { command: 'man', description: 'Display manual pages', category: 'Search' },
  { command: 'apropos', description: 'Search manual pages', category: 'Search' },
  { command: 'whatis', description: 'One-line manual description', category: 'Search' },
  { command: 'inotifywait', description: 'Wait for filesystem events', category: 'Search' },

  // Common compound commands
  { command: 'echo $PATH', description: 'Print PATH variable', category: 'System' },
  { command: 'source', description: 'Execute commands from file', category: 'System' },
  { command: '.', description: 'Execute commands from file (alias of source)', category: 'System' },
  { command: 'history', description: 'Show command history', category: 'System' },
  { command: 'clear', description: 'Clear terminal screen', category: 'System' },
  { command: 'exit', description: 'Exit shell session', category: 'System' },
  { command: 'reset', description: 'Reset terminal', category: 'System' },
];

export function getCommandDatabase(): CommandDef[] {
  return commandDatabase;
}

export function getCommandsByCategory(category: CommandCategory): CommandDef[] {
  return commandDatabase.filter((c) => c.category === category);
}

export function getCategoryOrder(): CommandCategory[] {
  return CATEGORY_ORDER;
}

export function searchCommands(query: string): CommandDef[] {
  const q = query.toLowerCase();
  return commandDatabase.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
  );
}
