class QRScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.isScanning = false;
        this.scanInterval = null;
        this.init();
    }

    init() {
        this.video = document.getElementById('scanner-video');
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
    }

    // بدء المسح
    async startScanner() {
        if (this.isScanning) return;

        try {
            // التحقق من دعم المتصفح
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                AlertSystem.error('متصفحك لا يدعم استخدام الكاميرا');
                return;
            }

            // التحقق من HTTPS
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                AlertSystem.error('يجب استخدام HTTPS لتشغيل الكاميرا');
                return;
            }

            // طلب إذن الوصول للكاميرا
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            this.video.srcObject = this.stream;
            this.isScanning = true;

            // إظهار عناصر الماسح
            document.getElementById('scanner-container').style.display = 'block';
            document.getElementById('start-scan-btn').style.display = 'none';
            document.getElementById('stop-scan-btn').style.display = 'inline-block';

            // انتظار تحميل الفيديو
            this.video.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                
                // بدء عملية المسح كل 100ms
                this.scanInterval = setInterval(() => {
                    this.scanFrame();
                }, 100);
            });

            AlertSystem.info('تم تشغيل الماسح. وجه الكاميرا نحو QR Code');

        } catch (error) {
            console.error('Error starting scanner:', error);
            
            if (error.name === 'NotAllowedError') {
                AlertSystem.error('يرجى السماح بالوصول للكاميرا لاستخدام الماسح');
            } else if (error.name === 'NotFoundError') {
                AlertSystem.error('لم يتم العثور على كاميرا في جهازك');
            } else {
                AlertSystem.error('فشل في تشغيل الماسح: ' + error.message);
            }
            
            this.stopScanner();
        }
    }

    // إيقاف المسح
    stopScanner() {
        if (!this.isScanning) return;

        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.isScanning = false;

        // إخفاء عناصر الماسح
        document.getElementById('scanner-container').style.display = 'none';
        document.getElementById('start-scan-btn').style.display = 'inline-block';
        document.getElementById('stop-scan-btn').style.display = 'none';

        AlertSystem.info('تم إيقاف الماسح');
    }

    // مسح الإطار الحالي
    scanFrame() {
        if (!this.isScanning || !this.video || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
            return;
        }

        try {
            // رسم الإطار الحالي على Canvas
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // الحصول على بيانات الصورة
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // محاولة قراءة QR Code باستخدام مكتبة jsQR
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code && code.data) {
                this.handleQRDetected(code.data);
            }

        } catch (error) {
            console.error('Error scanning frame:', error);
        }
    }

    // معالجة QR Code المكتشف - مبسط ومضمون
    handleQRDetected(qrData) {
        console.log('🎯 QR Code detected:', qrData);
        this.stopScanner();

        // استخراج الكود المختصر - طريقة مبسطة
        const shortCode = this.extractShortCode(qrData);
        
        if (shortCode) {
            console.log('✅ Short code extracted:', shortCode);
            
            if (window.clientPanel) {
                window.clientPanel.setScannedUrl(shortCode);
            }
            
            AlertSystem.success(`تم التعرف على الكود: ${shortCode}`);
            
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        } else {
            console.log('❌ Failed to extract code from:', qrData);
            AlertSystem.error(`لم يتم العثور على كود صحيح. البيانات: ${qrData}`);
        }
    }

    // استخراج الكود - مبسط جداً
    extractShortCode(qrData) {
        try {
            console.log('🔍 Extracting from:', qrData);
            
            // تنظيف البيانات
            qrData = qrData.trim();
            
            // الطريقة 1: إذا كان رابط كامل
            if (qrData.includes('nextdztech.netlify.app/')) {
                const parts = qrData.split('nextdztech.netlify.app/');
                if (parts.length >= 2) {
                    let code = parts[1];
                    
                    // إزالة معاملات إضافية (?، #)
                    if (code.includes('?')) {
                        code = code.split('?')[0];
                    }
                    if (code.includes('#')) {
                        code = code.split('#')[0];
                    }
                    
                    console.log('📡 Code from domain split:', code);
                    
                    if (this.isValidCode(code)) {
                        return code;
                    }
                }
            }
            
            // الطريقة 2: إذا كان رابط عام
            if (qrData.includes('://')) {
                try {
                    const url = new URL(qrData);
                    let pathname = url.pathname;
                    
                    // إزالة /
                    if (pathname.startsWith('/')) {
                        pathname = pathname.substring(1);
                    }
                    
                    console.log('🌐 Code from URL pathname:', pathname);
                    
                    if (this.isValidCode(pathname)) {
                        return pathname;
                    }
                } catch (e) {
                    console.log('❌ URL parsing failed:', e);
                }
            }
            
            // الطريقة 3: إذا كان مجرد كود
            if (this.isValidCode(qrData)) {
                console.log('📝 Direct code:', qrData);
                return qrData;
            }
            
            // الطريقة 4: بحث في النص
            const match = qrData.match(/([a-zA-Z0-9]{3,20})/);
            if (match && this.isValidCode(match[1])) {
                console.log('🔎 Code from regex:', match[1]);
                return match[1];
            }
            
            console.log('❌ No valid code found');
            return null;
            
        } catch (error) {
            console.error('❌ Extract error:', error);
            return null;
        }
    }

    // التحقق من صحة الكود - مبسط
    isValidCode(code) {
        if (!code || typeof code !== 'string') return false;
        
        const isValid = /^[a-zA-Z0-9]{3,20}$/.test(code.trim());
        console.log(`✓ Code "${code}" valid: ${isValid}`);
        return isValid;
    }
}

// وظائف عامة
let qrScanner = null;

function startScanner() {
    if (!qrScanner) {
        qrScanner = new QRScanner();
    }
    qrScanner.startScanner();
}

function stopScanner() {
    if (qrScanner) {
        qrScanner.stopScanner();
    }
}

// تحميل مكتبة jsQR
function loadJsQRLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof jsQR !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        script.onload = () => {
            console.log('✅ jsQR library loaded');
            resolve();
        };
        script.onerror = () => {
            console.error('❌ Failed to load jsQR library');
            reject(new Error('Failed to load jsQR library'));
        };
        document.head.appendChild(script);
    });
}

// تهيئة الماسح عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // تحميل مكتبة jsQR
        await loadJsQRLibrary();
        console.log('📱 QR Scanner ready');

    } catch (error) {
        console.error('❌ QR Scanner init error:', error);
        AlertSystem.error('فشل في تهيئة ماسح QR Code');
    }
});