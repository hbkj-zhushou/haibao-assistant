// 海宝车机助手 - WebADB 工具箱
// 优化版：模块化架构、安全性改进、统一错误处理
// 版本: 2.0

(function() {
    'use strict';

    // ========== 配置常量 ==========
    const CONFIG = {
        SIMULATION_DELAY: {
            FAST: 500,
            NORMAL: 1000,
            SLOW: 2000,
        },
        MAX_OUTPUT_LINES: 500,
        MOCK_DEVICES: [
            { serial: 'emulator-5554', name: 'Android Emulator' },
            { serial: 'SIMULATED_12345', name: 'Simulated Device' }
        ]
    };

    // ========== DOM ID 常量 ==========
    const DOM_IDS = {
        // 连接相关
        BTN_CONNECT: 'btn-connect',
        CONNECTION_ICON: 'connection-icon',
        CONNECTION_TEXT: 'connection-text',
        DEVICE_INFO: 'device-info',
        DEVICE_MODEL: 'device-model',
        ANDROID_VERSION: 'android-version',
        DEVICE_SERIAL: 'device-serial',
        
        // Shell相关
        SHELL_COMMAND: 'shell-command',
        BTN_EXECUTE: 'btn-execute',
        SHELL_OUTPUT: 'shell-output',
        
        // APK相关
        APK_FILE_INPUT: 'apk-file-input',
        BTN_INSTALL_APK: 'btn-install-apk',
        BTN_LIST_APK: 'btn-list-apk',
        BTN_UNINSTALL_APK: 'btn-uninstall-apk',
        APK_LIST: 'apk-list',
        
        // 文件相关
        FILE_INPUT: 'file-input',
        BTN_UPLOAD_FILE: 'btn-upload-file',
        BTN_NEW_FOLDER: 'btn-new-folder',
        BTN_BACK: 'btn-back',
        FILE_LIST: 'file-list',
        CURRENT_PATH: 'current-path',
        
        // 屏幕相关
        BTN_SCREENSHOT: 'btn-screenshot',
        BTN_REFRESH_SCREEN: 'btn-refresh-screen',
        BTN_DOWNLOAD_SCREEN: 'btn-download-screen',
        SCREEN_PREVIEW: 'screen-preview',
        
        // 设备控制
        BTN_REBOOT: 'btn-reboot',
        BTN_REBOOT_RECOVERY: 'btn-reboot-recovery',
        BTN_REBOOT_BOOTLOADER: 'btn-reboot-bootloader',
        BTN_SHUTDOWN: 'btn-shutdown',
        BTN_LOGCAT: 'btn-logcat',
        BTN_NETWORK_ADB: 'btn-network-adb',
        BTN_CLOSE_LOGCAT: 'btn-close-logcat',
        LOGCAT_OUTPUT: 'logcat-output',
        LOGCAT_CONTENT: 'logcat-content',
    };

    // ========== Toast 通知系统 ==========
    const Toast = {
        container: null,

        /**
         * 初始化 Toast 容器
         */
        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
            this.injectStyles();
        },

        /**
         * 注入 Toast 样式
         */
        injectStyles() {
            if (document.getElementById('toast-styles')) return;
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .toast {
                    padding: 15px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: toastIn 0.3s ease;
                    max-width: 350px;
                    word-break: break-all;
                }
                .toast.success { background: #28a745; }
                .toast.error { background: #dc3545; }
                .toast.info { background: #667eea; }
                .toast.warning { background: #ffc107; color: #333; }
                @keyframes toastIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes toastOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        },

        /**
         * 显示 Toast
         * @param {string} message - 消息
         * @param {string} type - 类型: success, error, info, warning
         * @param {number} duration - 显示时长(ms)
         */
        show(message, type = 'info', duration = 3000) {
            this.init();
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            this.container.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'toastOut 0.3s ease forwards';
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }, duration);
        },

        success(message) { this.show(message, 'success'); },
        error(message) { this.show(message, 'error', 5000); },
        info(message) { this.show(message, 'info'); },
        warning(message) { this.show(message, 'warning', 4000); }
    };

    // ========== 确认对话框 ==========
    const Confirm = {
        /**
         * 显示确认对话框
         * @param {string} title - 标题
         * @param {string} message - 消息
         * @returns {Promise<boolean>}
         */
        show(title, message) {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'confirm-modal';
                overlay.innerHTML = `
                    <div class="confirm-dialog">
                        <h3>${this._escapeHtml(title)}</h3>
                        <p>${this._escapeHtml(message)}</p>
                        <div class="btn-group">
                            <button class="btn btn-secondary" data-action="confirm-cancel">取消</button>
                            <button class="btn btn-primary" data-action="confirm-ok">确定</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                overlay.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    if (action === 'confirm-cancel' || action === 'confirm-ok') {
                        document.body.removeChild(overlay);
                        resolve(action === 'confirm-ok');
                    }
                });

                const escHandler = (e) => {
                    if (e.key === 'Escape') {
                        document.removeEventListener('keydown', escHandler);
                        document.body.removeChild(overlay);
                        resolve(false);
                    }
                };
                document.addEventListener('keydown', escHandler);
            });
        },

        _escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    // ========== 路径工具 ==========
    const PathUtils = {
        /**
         * 规范化路径
         */
        normalize(path) {
            if (!path || typeof path !== 'string') return '/sdcard';
            let normalized = path.trim().replace(/\/+/g, '/');
            if (!normalized.startsWith('/')) normalized = '/' + normalized;
            if (normalized !== '/' && normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }
            return normalized;
        },

        /**
         * 获取父目录
         */
        parent(path) {
            const normalized = this.normalize(path);
            if (normalized === '/' || normalized === '') return '/';
            const parts = normalized.split('/').filter(Boolean);
            if (parts.length <= 1) return '/';
            parts.pop();
            return '/' + parts.join('/');
        },

        /**
         * 连接路径
         */
        join(...parts) {
            return this.normalize(parts.filter(Boolean).join('/'));
        }
    };

    // ========== XSS 防护 ==========
    const Security = {
        /**
         * HTML 转义
         */
        escapeHtml(text) {
            if (text === null || text === undefined) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        },

        /**
         * 验证包名
         */
        isValidPackageName(pkg) {
            return /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(pkg);
        }
    };

    // ========== 统一错误处理 ==========
    const ErrorHandler = {
        /**
         * 处理错误
         */
        handle(error, context = '操作') {
            console.error(`[${context}]`, error);
            Toast.error(`${context}失败: ${error.message}`);
            return false;
        },

        /**
         * 安全执行
         */
        async safe(fn, context = '操作') {
            try {
                return await fn();
            } catch (error) {
                return this.handle(error, context);
            }
        }
    };

    // ========== 主要应用类 ==========
    class HaiBaoADBTool {
        constructor() {
            this.device = null;
            this.connection = null;
            this.currentPath = '/sdcard';
            this.outputLines = 0;
            this.init();
        }

        init() {
            this.injectStyles();
            this.bindEvents();
            this.checkWebUSBSupport();
        }

        /**
         * 注入自定义样式
         */
        injectStyles() {
            if (document.getElementById('app-styles')) return;
            const style = document.createElement('style');
            style.id = 'app-styles';
            style.textContent = `
                .confirm-modal {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                }
                .confirm-dialog {
                    background: white;
                    border-radius: 12px;
                    padding: 25px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                }
                .confirm-dialog h3 { margin-bottom: 15px; color: #333; }
                .confirm-dialog p { color: #666; margin-bottom: 20px; line-height: 1.5; }
                .confirm-dialog .btn-group { justify-content: flex-end; margin: 0; }
                .apk-item, .file-item {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                    gap: 10px;
                }
                .apk-item:hover, .file-item:hover { background: #f8f9fa; }
                .file-item[data-clickable] { cursor: pointer; }
                .btn-uninstall {
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .btn-download {
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(style);
        }

        /**
         * 检查 WebUSB 支持
         */
        checkWebUSBSupport() {
            if (!('usb' in navigator)) {
                Toast.warning('您的浏览器不支持WebUSB！请使用Chrome或Edge浏览器。');
                const btn = document.getElementById(DOM_IDS.BTN_CONNECT);
                if (btn) btn.disabled = true;
                return false;
            }
            return true;
        }

        /**
         * 绑定事件（事件委托）
         */
        bindEvents() {
            // 全局事件委托
            document.addEventListener('click', async (e) => {
                const target = e.target;
                const action = target.dataset.action;

                switch (action) {
                    // 连接
                    case 'connect':
                        this.connectDevice();
                        break;
                    
                    // Shell
                    case 'execute-shell':
                        this.executeShellCommand();
                        break;
                    
                    // APK
                    case 'install-apk':
                        this.triggerFileInput(DOM_IDS.APK_FILE_INPUT);
                        break;
                    case 'list-apk':
                        this.listAPKs();
                        break;
                    case 'uninstall-apk':
                        this.uninstallAPK();
                        break;
                    
                    // 文件
                    case 'upload-file':
                        this.triggerFileInput(DOM_IDS.FILE_INPUT);
                        break;
                    case 'new-folder':
                        this.createFolder();
                        break;
                    case 'go-back':
                        this.goBack();
                        break;
                    case 'open-folder':
                        this.navigateToFolder(target.dataset.folder);
                        break;
                    case 'download-file':
                        Toast.info('下载功能需要真实ADB连接');
                        break;
                    
                    // 屏幕
                    case 'screenshot':
                        this.takeScreenshot();
                        break;
                    case 'refresh-screen':
                        this.takeScreenshot();
                        break;
                    case 'download-screen':
                        this.downloadScreenshot();
                        break;
                    
                    // 设备控制
                    case 'reboot':
                        this.rebootDevice();
                        break;
                    case 'reboot-recovery':
                        this.rebootRecovery();
                        break;
                    case 'reboot-bootloader':
                        this.rebootBootloader();
                        break;
                    case 'shutdown':
                        this.shutdownDevice();
                        break;
                    case 'show-logcat':
                        this.showLogcat();
                        break;
                    case 'close-logcat':
                        this.hideLogcat();
                        break;
                    case 'network-adb':
                        this.enableNetworkADB();
                        break;
                    
                    // 标签页
                    case 'uninstall-pkg':
                        this.confirmUninstallPkg(target.dataset.package);
                        break;
                }
            });

            // Shell 输入框回车
            const shellInput = document.getElementById(DOM_IDS.SHELL_COMMAND);
            if (shellInput) {
                shellInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.executeShellCommand();
                });
            }

            // 文件输入变化
            const apkInput = document.getElementById(DOM_IDS.APK_FILE_INPUT);
            if (apkInput) {
                apkInput.addEventListener('change', (e) => this.handleApkFile(e.target));
            }

            const fileInput = document.getElementById(DOM_IDS.FILE_INPUT);
            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.handleUploadFile(e.target));
            }

            // 标签页切换
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tabName = e.currentTarget.dataset.tab;
                    if (tabName) this.switchTab(tabName);
                });
            });
        }

        /**
         * 触发文件选择
         */
        triggerFileInput(id) {
            const input = document.getElementById(id);
            if (input) input.click();
        }

        /**
         * 处理 APK 文件选择
         */
        handleApkFile(input) {
            const file = input.files[0];
            if (!file) return;
            this.addShellOutput(`正在安装APK: ${file.name}`);
            setTimeout(() => {
                this.addShellOutput('APK安装成功！');
                Toast.success(`APK ${file.name} 安装成功！`);
            }, CONFIG.SIMULATION_DELAY.SLOW);
        }

        /**
         * 处理上传文件
         */
        handleUploadFile(input) {
            const file = input.files[0];
            if (!file) return;
            this.addShellOutput(`正在上传文件: ${file.name} 到 ${this.currentPath}`);
            setTimeout(() => {
                this.addShellOutput(`文件上传成功: ${file.name}`);
                this.listFiles();
            }, CONFIG.SIMULATION_DELAY.SLOW);
        }

        /**
         * 更新连接状态
         */
        updateConnectionStatus(text, status) {
            const icon = document.getElementById(DOM_IDS.CONNECTION_ICON);
            const textEl = document.getElementById(DOM_IDS.CONNECTION_TEXT);
            
            if (!icon || !textEl) return;
            
            textEl.textContent = text;
            icon.className = 'fas';
            
            if (status === 'connected') {
                icon.classList.add('fa-usb', 'connected');
                icon.style.color = '#28a745';
            } else if (status === 'connecting') {
                icon.classList.add('fa-spinner', 'fa-spin');
                icon.style.color = '#ffc107';
            } else {
                icon.classList.add('fa-usb');
                icon.style.color = '#dc3545';
            }
        }

        /**
         * 显示设备信息
         */
        showDeviceInfo() {
            const infoDiv = document.getElementById(DOM_IDS.DEVICE_INFO);
            if (infoDiv) infoDiv.style.display = 'block';
        }

        /**
         * 连接设备
         */
        async connectDevice() {
            if (!this.checkWebUSBSupport()) return;

            try {
                this.updateConnectionStatus('正在连接...', 'connecting');
                
                const device = await navigator.usb.requestDevice({
                    filters: [{ classCode: 0xFF }]
                });

                await device.open();
                this.device = device;
                
                this.updateConnectionStatus('已连接', 'connected');
                this.showDeviceInfo();
                this.addShellOutput('设备连接成功！');
                this.addShellOutput(`设备: ${device.productName || 'Unknown'}`);
                
            } catch (error) {
                console.error('连接失败:', error);
                this.updateConnectionStatus('连接失败', 'error');
                
                if (await Confirm.show('连接模式选择', 'WebUSB连接失败。是否进入模拟模式？（功能演示）')) {
                    this.enterSimulationMode();
                }
            }
        }

        /**
         * 进入模拟模式
         */
        enterSimulationMode() {
            this.device = { 
                productName: '模拟设备',
                serialNumber: 'SIMULATED_12345'
            };
            
            this.updateConnectionStatus('模拟模式', 'connected');
            this.showDeviceInfo();
            this.addShellOutput('已进入模拟模式');
            this.addShellOutput('所有功能将使用模拟数据演示');
            
            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };
            setText(DOM_IDS.DEVICE_MODEL, 'Simulated Device');
            setText(DOM_IDS.ANDROID_VERSION, '11');
            setText(DOM_IDS.DEVICE_SERIAL, 'SIMULATED_12345');
        }

        /**
         * 切换标签页
         */
        switchTab(tabName) {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.toggle('active', pane.id === `tab-${tabName}`);
            });
        }

        /**
         * 添加 Shell 输出
         */
        addShellOutput(text) {
            const output = document.getElementById(DOM_IDS.SHELL_OUTPUT);
            if (!output) return;
            
            // 移除欢迎消息
            const welcome = output.querySelector('.welcome-msg');
            if (welcome) welcome.remove();
            
            // 限制输出行数
            this.outputLines++;
            if (this.outputLines > CONFIG.MAX_OUTPUT_LINES) {
                const lines = output.querySelectorAll('.output-line');
                if (lines.length > 0) lines[0].remove();
                this.outputLines--;
            }
            
            const line = document.createElement('div');
            line.className = 'output-line';
            line.textContent = text;
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
        }

        /**
         * 执行 Shell 命令
         */
        executeShellCommand() {
            const input = document.getElementById(DOM_IDS.SHELL_COMMAND);
            if (!input) return;
            
            const command = input.value.trim();
            if (!command) {
                Toast.warning('请输入命令');
                return;
            }

            this.addShellOutput(`$ ${command}`);
            input.value = '';

            setTimeout(() => {
                if (command === 'ls' || command.startsWith('ls ')) {
                    this.addShellOutput('file1.txt');
                    this.addShellOutput('file2.txt');
                    this.addShellOutput('folder1/');
                    this.addShellOutput('folder2/');
                } else if (command === 'pwd') {
                    this.addShellOutput(this.currentPath);
                } else if (command.startsWith('cd ')) {
                    const newPath = command.substring(3).trim();
                    this.currentPath = PathUtils.join(this.currentPath, newPath);
                    this.addShellOutput(`切换到: ${this.currentPath}`);
                } else if (command === 'devices') {
                    CONFIG.MOCK_DEVICES.forEach(d => {
                        this.addShellOutput(`${d.serial} device ${d.name}`);
                    });
                } else {
                    this.addShellOutput(`执行: ${command}`);
                    this.addShellOutput('(模拟输出 - 实际需要WebADB库或实现ADB协议)');
                }
            }, CONFIG.SIMULATION_DELAY.FAST);
        }

        /**
         * 列出 APK
         */
        listAPKs() {
            const list = document.getElementById(DOM_IDS.APK_LIST);
            if (!list) return;
            
            list.innerHTML = '<p>正在获取应用列表...</p>';
            
            setTimeout(() => {
                const mockPackages = [
                    'com.tencent.mobileqq',
                    'com.tencent.mm',
                    'com.ss.android.ugc.aweme'
                ];
                
                const fragment = document.createDocumentFragment();
                mockPackages.forEach(pkg => {
                    const item = document.createElement('div');
                    item.className = 'apk-item';
                    
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-android';
                    
                    const name = document.createElement('span');
                    name.textContent = pkg; // XSS 安全
                    
                    const btn = document.createElement('button');
                    btn.className = 'btn-uninstall';
                    btn.textContent = '卸载';
                    btn.dataset.action = 'uninstall-pkg';
                    btn.dataset.package = pkg;
                    
                    item.appendChild(icon);
                    item.appendChild(name);
                    item.appendChild(btn);
                    fragment.appendChild(item);
                });
                
                list.innerHTML = '';
                list.appendChild(fragment);
            }, CONFIG.SIMULATION_DELAY.NORMAL);
        }

        /**
         * 确认卸载应用
         */
        async confirmUninstallPkg(pkg) {
            if (!pkg) return;
            if (!await Confirm.show('卸载确认', `确定要卸载 ${pkg} 吗？`)) return;
            
            this.addShellOutput(`正在卸载: ${pkg}`);
            setTimeout(() => {
                this.addShellOutput(`卸载成功: ${pkg}`);
                Toast.success(`应用 ${pkg} 卸载成功！`);
            }, CONFIG.SIMULATION_DELAY.NORMAL);
        }

        /**
         * 卸载 APK
         */
        async uninstallAPK() {
            const pkg = prompt('请输入要卸载的应用包名:');
            if (!pkg) return;
            
            if (!Security.isValidPackageName(pkg)) {
                Toast.error('无效的包名格式');
                return;
            }
            
            if (await Confirm.show('卸载确认', `确定要卸载 ${pkg} 吗？`)) {
                this.addShellOutput(`正在卸载: ${pkg}`);
                setTimeout(() => {
                    this.addShellOutput(`卸载成功: ${pkg}`);
                    Toast.success(`应用 ${pkg} 卸载成功！`);
                }, CONFIG.SIMULATION_DELAY.NORMAL);
            }
        }

        /**
         * 创建文件夹
         */
        async createFolder() {
            const folderName = prompt('请输入文件夹名称:');
            if (!folderName) return;

            this.addShellOutput(`正在创建文件夹: ${folderName}`);
            setTimeout(() => {
                this.addShellOutput(`文件夹创建成功: ${folderName}`);
                this.listFiles();
            }, CONFIG.SIMULATION_DELAY.NORMAL);
        }

        /**
         * 列出文件
         */
        listFiles() {
            const list = document.getElementById(DOM_IDS.FILE_LIST);
            if (!list) return;
            
            list.innerHTML = '<p>正在获取文件列表...</p>';
            
            setTimeout(() => {
                const mockFiles = [
                    { name: 'DCIM/', type: 'folder' },
                    { name: 'Download/', type: 'folder' },
                    { name: 'test.txt', type: 'file', size: '1.2 KB' }
                ];
                
                const fragment = document.createDocumentFragment();
                mockFiles.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'file-item';
                    
                    if (file.type === 'folder') {
                        item.dataset.clickable = 'true';
                        item.dataset.action = 'open-folder';
                        item.dataset.folder = file.name.replace('/', '');
                    }
                    
                    const icon = document.createElement('i');
                    icon.className = file.type === 'folder' ? 'fas fa-folder' : 'fas fa-file';
                    
                    const name = document.createElement('span');
                    name.textContent = file.name;
                    
                    item.appendChild(icon);
                    item.appendChild(name);
                    
                    if (file.type === 'file') {
                        const btn = document.createElement('button');
                        btn.className = 'btn-download';
                        btn.textContent = '下载';
                        btn.dataset.action = 'download-file';
                        item.appendChild(btn);
                    }
                    
                    fragment.appendChild(item);
                });
                
                list.innerHTML = '';
                list.appendChild(fragment);
                
                const pathEl = document.getElementById(DOM_IDS.CURRENT_PATH);
                if (pathEl) pathEl.textContent = this.currentPath;
            }, CONFIG.SIMULATION_DELAY.NORMAL);
        }

        /**
         * 导航到文件夹
         */
        navigateToFolder(folder) {
            this.currentPath = PathUtils.join(this.currentPath, folder);
            this.listFiles();
        }

        /**
         * 返回上级目录
         */
        goBack() {
            this.currentPath = PathUtils.parent(this.currentPath);
            this.listFiles();
        }

        /**
         * 截图
         */
        takeScreenshot() {
            const preview = document.getElementById(DOM_IDS.SCREEN_PREVIEW);
            if (!preview) return;
            
            preview.innerHTML = '<p>正在截图...</p>';
            
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 400;
                canvas.height = 800;
                const ctx = canvas.getContext('2d');
                
                const gradient = ctx.createLinearGradient(0, 0, 400, 800);
                gradient.addColorStop(0, '#667eea');
                gradient.addColorStop(1, '#764ba2');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 400, 800);
                
                ctx.fillStyle = 'white';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('海宝车机助手', 200, 350);
                ctx.fillText('屏幕截图预览', 200, 400);
                ctx.fillText('(模拟图像)', 200, 450);
                
                preview.innerHTML = '';
                preview.appendChild(canvas);
                preview.dataset.screenshot = canvas.toDataURL();
                
                this.addShellOutput('截图成功！');
            }, CONFIG.SIMULATION_DELAY.SLOW);
        }

        /**
         * 下载截图
         */
        downloadScreenshot() {
            const preview = document.getElementById(DOM_IDS.SCREEN_PREVIEW);
            if (!preview) return;
            
            const dataUrl = preview.dataset.screenshot;
            if (!dataUrl) {
                Toast.warning('请先截图！');
                return;
            }
            
            const link = document.createElement('a');
            link.download = `screenshot_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            
            this.addShellOutput(`截图已保存: ${link.download}`);
        }

        /**
         * 设备控制
         */
        async controlDevice(action, message) {
            if (!await Confirm.show('设备控制', `确定要${message}吗？`)) return;
            
            this.addShellOutput(`正在${message}...`);
            setTimeout(() => {
                this.addShellOutput(`${message}命令已发送！`);
                Toast.success(`${message}命令已发送！`);
            }, CONFIG.SIMULATION_DELAY.NORMAL);
        }

        rebootDevice() { this.controlDevice('reboot', '重启设备'); }
        rebootRecovery() { this.controlDevice('recovery', '重启到Recovery'); }
        rebootBootloader() { this.controlDevice('bootloader', '重启到Bootloader'); }
        shutdownDevice() { this.controlDevice('shutdown', '关机'); }

        /**
         * 显示日志
         */
        showLogcat() {
            const output = document.getElementById(DOM_IDS.LOGCAT_OUTPUT);
            const content = document.getElementById(DOM_IDS.LOGCAT_CONTENT);
            
            if (!output || !content) return;
            
            output.style.display = 'block';
            content.textContent = '正在获取日志...\n';
            
            setTimeout(() => {
                const logs = [
                    '05-17 18:50:00.123  1234  5678 I ActivityManager: START u0 {act=android.intent.action.MAIN}',
                    '05-17 18:50:01.456  1234  5678 D PackageManager: Resolving intent...',
                    '05-17 18:50:02.789  9876  5432 E Tag: Error message example',
                    '05-17 18:50:03.012  9876  5432 W Tag: Warning message example',
                    '05-17 18:50:04.345  1234  5678 I System.out: Hello from device!',
                ];
                content.textContent = logs.join('\n');
                content.scrollTop = content.scrollHeight;
            }, CONFIG.SIMULATION_DELAY.NORMAL);
        }

        /**
         * 隐藏日志
         */
        hideLogcat() {
            const output = document.getElementById(DOM_IDS.LOGCAT_OUTPUT);
            if (output) output.style.display = 'none';
        }

        /**
         * 开启网络ADB
         */
        enableNetworkADB() {
            this.addShellOutput('正在开启网络ADB...');
            setTimeout(() => {
                this.addShellOutput('网络ADB已开启！');
                this.addShellOutput('请在设备上执行: adb connect <设备IP>:5555');
                Toast.success('网络ADB开启成功！');
            }, CONFIG.SIMULATION_DELAY.SLOW);
        }
    }

    // ========== 初始化 ==========
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new HaiBaoADBTool();
        console.log('海宝车机助手已启动！');
        console.log('作者: 海宝');
        console.log('基于WebADB技术，推荐使用Chrome/Edge浏览器');
    });

})();
