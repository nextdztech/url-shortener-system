
class QRScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.isScanning = false;
        this.init();
    }

    init() {
        this.video = document.getElementById('scanner-video');
    }

    // بدء المسح
    async startScanner() {
        if (this.isScanning) return;

        try {
            // طلب إذن الوصول للكاميرا
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment' // الكاميرا الخلفية إذا كانت متاحة
                } 
            });
            
            this.video.srcObject = this.stream;
            this.isScanning = true;

            // إظهار عناصر الماسح
            document.getElementById('scanner-container').style.display = 'block';
            document.getElementById('start-scan-btn').style.display = 'none';
            document.getElementById('stop-scan-btn').style.display = 'inline-block';

            // بدء عملية المسح
            this.scanFrame();

            AlertSystem.info('تم تشغيل الماسح. وجه الكاميرا نحو QR Code');

        } catch (error) {
            console.error('Error starting scanner:', error);
            
            if (error.name === 'NotAllowedError') {
                AlertSystem.error('يرجى السماح بالوصول للكاميرا');
            } else if (error.name === 'NotFoundError') {
                AlertSystem.error('لم يتم العثور على كاميرا');
            } else {
                AlertSystem.error('فشل في تشغيل الماسح');
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

        // إخفاء عناصر الماسح
        document.getElementById('scanner-container').style.display = 'none';
        document.getElementById('start-scan-btn').style.display = 'inline-block';
        document.getElementById('stop-scan-btn').style.display = 'none';

        AlertSystem.info('تم إيقاف الماسح');
    }

    // مسح الإطار الحالي
    async scanFrame() {
        if (!this.isScanning) return;

        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            
            context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
            
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            // محاولة قراءة QR Code
            const code = this.decodeQR(imageData);
            
            if (code) {
                this.handleQRDetected(code);
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

    // فك تشفير QR Code (تطبيق مبسط)
    decodeQR(imageData) {
        // هذا تطبيق مبسط - في التطبيق الحقيقي نحتاج مكتبة متخصصة
        // مثل jsQR أو qr-scanner
        
        // للتجربة، سنحاكي التعرف على QR Code
        // يمكن تحسين هذا لاحقاً باستخدام مكتبة حقيقية
        
        return null; // سيتم استبداله بمكتبة حقيقية
    }

    // معالجة QR Code المكتشف
    handleQRDetected(qrData) {
        this.stopScanner();

        // استخراج الكود المختصر من QR
        const shortCode = this.extractShortCodeFromQR(qrData);
        
        if (shortCode) {
            if (window.clientPanel) {
                window.clientPanel.setScannedUrl(shortCode);
            }
            AlertSystem.success('تم التعرف على QR Code بنجاح!');
        } else {
            AlertSystem.error('QR Code غير صحيح');
        }
    }

    // استخراج الكود المختصر من بيانات QR
    extractShortCodeFromQR(qrData) {
        try {
            // إذا كان QR يحتوي على رابط كامل
            if (qrData.includes('://')) {
                const url = new URL(qrData);
                const pathname = url.pathname;
                const shortCode = pathname.substring(1);
                
                if (/^[a-zA-Z0-9]+$/.test(shortCode) && shortCode.length >= 4) {
                    return shortCode;
                }
            }
            
            // إذا كان QR يحتوي على الكود فقط
            if (/^[a-zA-Z0-9]+$/.test(qrData) && qrData.length >= 4 && qrData.length <= 10) {
                return qrData;
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting short code from QR:', error);
            return null;
        }
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

// تهيئة الماسح عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من دعم المتصفح للكاميرا
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        AlertSystem.warning('متصفحك لا يدعم استخدام الكاميرا');
        document.getElementById('start-scan-btn').disabled = true;
        document.getElementById('start-scan-btn').textContent = 'الكاميرا غير مدعومة';
    }
});
