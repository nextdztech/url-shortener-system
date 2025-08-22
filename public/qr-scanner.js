
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
                    facingMode: { ideal: 'environment' }, // الكاميرا الخلفية أولاً
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
            } else if (error.name === 'NotSupportedError') {
                AlertSystem.error('المتصفح لا يدعم استخدام الكاميرا');
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

    // معالجة QR Code المكتشف
    handleQRDetected(qrData) {
        console.log('QR Code detected:', qrData);
        this.stopScanner();

        // استخراج الكود المختصر من QR
        const shortCode = this.extractShortCodeFromQR(qrData);
        
        if (shortCode) {
            if (window.clientPanel) {
                window.clientPanel.setScannedUrl(shortCode);
            }
            AlertSystem.success('تم التعرف على QR Code بنجاح! الكود: ' + shortCode);
            
            // إضافة اهتزاز إذا كان مدعوماً
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }
        } else {
            AlertSystem.error('QR Code لا يحتوي على رابط صحيح');
            console.log('QR Data:', qrData);
        }
    }

    // استخراج الكود المختصر من بيانات QR
    extractShortCodeFromQR(qrData) {
        try {
            console.log('Extracting from QR data:', qrData);
            
            // تنظيف البيانات
            qrData = qrData.trim();
            
            // إذا كان QR يحتوي على رابط كامل
            if (qrData.includes('://')) {
                try {
                    const url = new URL(qrData);
                    let pathname = url.pathname;
                    
                    // إزالة الشرطة المائلة الأولى
                    if (pathname.startsWith('/')) {
                        pathname = pathname.substring(1);
                    }
                    
                    // التحقق من صحة الكود
                    if (this.isValidShortCode(pathname)) {
                        return pathname;
                    }
                } catch (urlError) {
                    console.error('URL parsing error:', urlError);
                }
            }
            
            // إذا كان QR يحتوي على الكود فقط
            if (this.isValidShortCode(qrData)) {
                return qrData;
            }
            
            // محاولة استخراج الكود من نص عادي
            const codeMatch = qrData.match(/([a-zA-Z0-9]{3,20})/);
            if (codeMatch && this.isValidShortCode(codeMatch[1])) {
                return codeMatch[1];
            }
            
            return null;
            
        } catch (error) {
            console.error('Error extracting short code from QR:', error);
            return null;
        }
    }

    // التحقق من صحة الكود المختصر
    isValidShortCode(code) {
        return /^[a-zA-Z0-9]{3,20}$/.test(code);
    }
}

// وظائف عامة للماسح
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
            console.log('jsQR library loaded successfully');
            resolve();
        };
        script.onerror = () => {
            console.error('Failed to load jsQR library');
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
        
        // التحقق من دعم المتصفح للكاميرا
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            AlertSystem.warning('متصفحك لا يدعم استخدام الكاميرا');
            const startBtn = document.getElementById('start-scan-btn');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = 'الكاميرا غير مدعومة';
            }
            return;
        }

        // التحقق من HTTPS
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            AlertSystem.warning('يجب استخدام HTTPS لتشغيل الكاميرا');
            const startBtn = document.getElementById('start-scan-btn');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = 'يتطلب HTTPS';
            }
            return;
        }

        console.log('QR Scanner initialized successfully');

    } catch (error) {
        console.error('Error initializing QR scanner:', error);
        AlertSystem.error('فشل في تهيئة ماسح QR Code');
        
        const startBtn = document.getElementById('start-scan-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'خطأ في التهيئة';
        }
    }
});

// =====================================
// تحديث ملف: public/client.html - إضافة تحسينات للماسح
// =====================================

// أضف هذا في قسم <style> في client.html:

/*
.scanner-info {
    background: #e3f2fd;
    padding: 15px;
    border-radius: 8px;
    margin: 15px 0;
    border-left: 4px solid #2196f3;
}

.scanner-tips {
    background: #fff3e0;
    padding: 15px;
    border-radius: 8px;
    margin: 15px 0;
    border-left: 4px solid #ff9800;
}

.scanner-tips ul {
    margin: 10px 0;
    padding-right: 20px;
}

.scanner-tips li {
    margin: 8px 0;
    line-height: 1.4;
}

.qr-demo {
    text-align: center;
    margin: 20px 0;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
}

.qr-demo img {
    max-width: 150px;
    border: 2px solid #ddd;
    border-radius: 8px;
}
*/

// وأضف هذا في HTML بعد scanner-controls:

/*
<div class="scanner-info">
    <h4>💡 نصائح للمسح الناجح:</h4>
    <ul>
        <li>تأكد من وجود إضاءة جيدة</li>
        <li>اقترب من QR Code (15-30 سم)</li>
        <li>حافظ على ثبات الكاميرا</li>
        <li>تأكد أن QR Code واضح في الإطار</li>
    </ul>
</div>

<div class="qr-demo">
    <h4>🎯 مثال للاختبار:</h4>
    <p>يمكنك اختبار الماسح بهذا QR Code:</p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://google.com" alt="QR Code للاختبار">
    <br>
    <small>هذا QR Code يحتوي على رابط Google للاختبار</small>
</div>
*/

// =====================================
// إضافة تحسينات CSS للماسح
// =====================================

/* أضف هذا في public/style.css */

/*
#scanner-video {
    width: 100%;
    max-width: 400px;
    height: auto;
    border-radius: var(--border-radius);
    border: 3px solid var(--primary-color);
    background: #000;
}

.scanner-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 200px;
    border: 3px solid #ff0000;
    border-radius: 15px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    animation: scannerPulse 2s ease-in-out infinite alternate;
}

@keyframes scannerPulse {
    0% {
        border-color: #ff0000;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    }
    100% {
        border-color: #00ff00;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
    }
}

.scanner-status {
    text-align: center;
    margin: 10px 0;
    padding: 8px;
    border-radius: 5px;
    font-weight: 600;
}

.scanner-status.active {
    background: #d4edda;
    color: #155724;
}

.scanner-status.error {
    background: #f8d7da;
    color: #721c24;
}
*/