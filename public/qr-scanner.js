
class QRScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.isScanning = false;
        this.jsQR = null; // سيتم تحميله ديناميكياً
        this.init();
    }

    async init() {
        this.video = document.getElementById('scanner-video');
        
        // تحميل مكتبة jsQR ديناميكياً
        await this.loadJsQR();
    }

    // تحميل مكتبة jsQR
    async loadJsQR() {
        if (window.jsQR) {
            this.jsQR = window.jsQR;
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
            script.onload = () => {
                this.jsQR = window.jsQR;
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

    // بدء المسح
    async startScanner() {
        if (this.isScanning) return;

        try {
            // التأكد من تحميل المكتبة
            if (!this.jsQR) {
                await this.loadJsQR();
            }

            // طلب إذن الوصول للكاميرا مع خيارات محسّنة
            const constraints = {
                video: {
                    facingMode: 'environment', // الكاميرا الخلفية
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    aspectRatio: { ideal: 16/9 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.video.srcObject = this.stream;
            this.isScanning = true;

            // انتظار تحميل الفيديو
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });

            // إظهار عناصر الماسح
            document.getElementById('scanner-container').style.display = 'block';
            document.getElementById('start-scan-btn').style.display = 'none';
            document.getElementById('stop-scan-btn').style.display = 'inline-block';

            // بدء عملية المسح
            this.scanFrame();

            AlertSystem.info('تم تشغيل الماسح. وجه الكاميرا نحو QR Code');

        } catch (error) {
            console.error('Error starting scanner:', error);
            this.isScanning = false;
            
            if (error.name === 'NotAllowedError') {
                AlertSystem.error('يرجى السماح بالوصول للكاميرا لاستخدام الماسح');
            } else if (error.name === 'NotFoundError') {
                AlertSystem.error('لم يتم العثور على كاميرا في الجهاز');
            } else if (error.message && error.message.includes('jsQR')) {
                AlertSystem.error('فشل في تحميل مكتبة قراءة QR Code');
            } else {
                AlertSystem.error('فشل في تشغيل الماسح: ' + error.message);
            }
        }
    }

    // إيقاف المسح
    stopScanner() {
        if (!this.isScanning) return;

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.isScanning = false;
        this.video.srcObject = null;

        // إخفاء عناصر الماسح
        document.getElementById('scanner-container').style.display = 'none';
        document.getElementById('start-scan-btn').style.display = 'inline-block';
        document.getElementById('stop-scan-btn').style.display = 'none';

        AlertSystem.info('تم إيقاف الماسح');
    }

    // مسح الإطار الحالي
    async scanFrame() {
        if (!this.isScanning || !this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            if (this.isScanning) {
                requestAnimationFrame(() => this.scanFrame());
            }
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // التأكد من أن الفيديو جاهز
            if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
                requestAnimationFrame(() => this.scanFrame());
                return;
            }
            
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            
            // رسم إطار الفيديو على الكانفاس
            context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
            
            // الحصول على بيانات الصورة
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            // محاولة قراءة QR Code باستخدام jsQR
            const code = this.decodeQR(imageData);
            
            if (code && code.data) {
                this.handleQRDetected(code.data);
                return;
            }

        } catch (error) {
            console.error('Error scanning frame:', error);
        }

        // الإطار التالي
        if (this.isScanning) {
            requestAnimationFrame(() => this.scanFrame());
        }
    }

    // فك تشفير QR Code باستخدام jsQR
    decodeQR(imageData) {
        if (!this.jsQR) {
            console.warn('jsQR library not loaded');
            return null;
        }

        try {
            // استخدام jsQR لفك تشفير QR Code
            const code = this.jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert", // محاولة القراءة بدون عكس الألوان أولاً
            });

            if (code) {
                console.log('QR Code detected:', code.data);
                return code;
            }

            return null;
        } catch (error) {
            console.error('Error decoding QR:', error);
            return null;
        }
    }

    // معالجة QR Code المكتشف
    handleQRDetected(qrData) {
        console.log('Processing QR data:', qrData);
        
        this.stopScanner();

        // استخراج الكود المختصر من QR
        const shortCode = this.extractShortCodeFromQR(qrData);
        
        if (shortCode) {
            if (window.clientPanel) {
                window.clientPanel.setScannedUrl(shortCode);
            }
            AlertSystem.success(`تم التعرف على QR Code بنجاح! الكود: ${shortCode}`);
        } else {
            AlertSystem.error('QR Code لا يحتوي على كود صحيح للنظام');
            console.log('Invalid QR data format:', qrData);
        }
    }

    // استخراج الكود المختصر من بيانات QR
    extractShortCodeFromQR(qrData) {
        try {
            console.log('Extracting short code from:', qrData);
            
            // إزالة المسافات الإضافية
            qrData = qrData.trim();

            // إذا كان QR يحتوي على رابط كامل
            if (qrData.includes('://')) {
                const url = new URL(qrData);
                let pathname = url.pathname;
                
                // إزالة الشرطة المائلة في البداية
                if (pathname.startsWith('/')) {
                    pathname = pathname.substring(1);
                }
                
                // إزالة أي مسار إضافي (مثل .html)
                const shortCode = pathname.split('/')[0].split('.')[0];
                
                if (this.isValidShortCode(shortCode)) {
                    console.log('Extracted short code from URL:', shortCode);
                    return shortCode;
                }
            }
            
            // إذا كان QR يحتوي على الكود فقط
            if (this.isValidShortCode(qrData)) {
                console.log('Direct short code detected:', qrData);
                return qrData;
            }
            
            // محاولة استخراج الكود من نص مختلط
            const matches = qrData.match(/[a-zA-Z0-9]{4,10}/g);
            if (matches && matches.length > 0) {
                for (const match of matches) {
                    if (this.isValidShortCode(match)) {
                        console.log('Extracted short code from mixed text:', match);
                        return match;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting short code from QR:', error);
            return null;
        }
    }

    // التحقق من صحة الكود المختصر
    isValidShortCode(code) {
        return typeof code === 'string' && 
               /^[a-zA-Z0-9]+$/.test(code) && 
               code.length >= 4 && 
               code.length <= 10;
    }

    // إضافة مؤشر بصري للمسح (اختياري)
    showScanningIndicator() {
        const indicator = document.getElementById('scanning-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }
    }

    hideScanningIndicator() {
        const indicator = document.getElementById('scanning-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

// وظائف عامة للماسح
let qrScanner = null;

async function startScanner() {
    try {
        if (!qrScanner) {
            qrScanner = new QRScanner();
        }
        await qrScanner.startScanner();
    } catch (error) {
        console.error('Error initializing scanner:', error);
        AlertSystem.error('فشل في تهيئة الماسح');
    }
}

function stopScanner() {
    if (qrScanner) {
        qrScanner.stopScanner();
    }
}

// تهيئة الماسح عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
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

    // التحقق من الاتصال الآمن (HTTPS)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        AlertSystem.warning('ماسح QR Code يتطلب اتصال آمن (HTTPS)');
        const startBtn = document.getElementById('start-scan-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'يتطلب HTTPS';
        }
        return;
    }

    console.log('QR Scanner initialized successfully');
});

// إضافة مستمع للأخطاء العامة
window.addEventListener('error', function(event) {
    if (event.message && event.message.includes('jsQR')) {
        console.error('jsQR library error:', event);
        AlertSystem.error('خطأ في مكتبة قراءة QR Code');
    }
});

// إضافة دعم لإيقاف الماسح عند إغلاق النافذة
window.addEventListener('beforeunload', function() {
    if (qrScanner && qrScanner.isScanning) {
        qrScanner.stopScanner();
    }
});