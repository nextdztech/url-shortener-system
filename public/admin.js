
class AdminPanel {
    constructor() {
        this.currentPage = 1;
        this.urlsPerPage = 10;
        this.urls = [];
        this.stats = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showSection('create');
        this.loadUrls();
        this.loadStats();
    }

    setupEventListeners() {
        // نموذج إنشاء رابط
        const createForm = document.getElementById('create-form');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreateUrl(e));
        }

        // البحث
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
    }

    // عرض قسم معين
    showSection(sectionName) {
        // إخفاء جميع الأقسام
        document.querySelectorAll('.admin-section').forEach(section => {
            section.style.display = 'none';
        });

        // إزالة الفئة النشطة من جميع الأزرار
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // إظهار القسم المحدد
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // تفعيل الزر المناسب
        const targetButton = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }

        // تحميل البيانات حسب القسم
        switch (sectionName) {
            case 'manage':
                this.loadUrls();
                break;
            case 'stats':
                this.loadStats();
                break;
        }
    }

    // إنشاء رابط جديد
    async handleCreateUrl(event) {
    event.preventDefault();
    
    const originalUrl = document.getElementById('original-url').value.trim();
    const customCode = document.getElementById('custom-code').value.trim();
    
    if (!originalUrl) {
        AlertSystem.error('يرجى إدخال رابط صحيح');
        return;
    }

    if (!Utils.isValidUrl(originalUrl)) {
        AlertSystem.error('الرابط غير صحيح');
        return;
    }

    // التحقق من الكود المخصص إذا تم إدخاله
    if (customCode) {
        const validation = Utils.validateAndCleanShortCode(customCode);
        if (!validation.isValid) {
            AlertSystem.error(validation.error);
            return;
        }
    }
        try {
            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '⏳ جاري الإنشاء...';
            submitBtn.disabled = true;

            const data = await URLShortenerAPI.createOrUpdateUrl({
                action: 'create',
                originalUrl: Utils.cleanUrl(originalUrl),
                customCode: customCode || undefined,
                userType: 'admin'
            });

            // عرض النتيجة
            const resultSection = document.getElementById('create-result');
            const shortUrlDisplay = document.getElementById('new-short-url');
            
            shortUrlDisplay.textContent = `${window.location.origin}/${data.data.shortCode}`;
            resultSection.style.display = 'block';

            // مسح النموذج
            event.target.reset();
            
            AlertSystem.success('تم إنشاء الرابط بنجاح!');
            
            // تحديث قائمة الروابط
            this.loadUrls();

        } catch (error) {
            AlertSystem.error(error.message || 'فشل في إنشاء الرابط');
        } finally {
            const submitBtn = event.target.querySelector('button[type="submit"]');
            submitBtn.textContent = '🚀 إنشاء الرابط';
            submitBtn.disabled = false;
        }
    }

    // تحميل قائمة الروابط
    async loadUrls(page = 1) {
        try {
            Utils.showLoading('urls-list', 'جاري تحميل الروابط...');

            const data = await URLShortenerAPI.getUrls({
                userType: 'admin',
                page: page,
                limit: this.urlsPerPage
            });

            this.urls = data.data.urls;
            this.currentPage = page;
            
            this.renderUrlsList();
            this.renderPagination(data.data.totalPages);

        } catch (error) {
            Utils.hideLoading('urls-list', '<div class="error">فشل في تحميل الروابط</div>');
            AlertSystem.error('فشل في تحميل الروابط');
        }
    }

   
    // عرض قائمة الروابط (تكملة)
    renderUrlsList() {
        const container = document.getElementById('urls-list');
        
        if (!this.urls || this.urls.length === 0) {
            container.innerHTML = '<div class="loading">لا توجد روابط</div>';
            return;
        }

        const urlsHTML = this.urls.map(url => `
            <div class="url-row">
                <div class="url-short">
                    <a href="/${url.shortCode}" target="_blank">/${url.shortCode}</a>
                </div>
                <div class="url-original" title="${url.originalUrl}">
                    ${url.originalUrl.length > 60 ? url.originalUrl.substring(0, 60) + '...' : url.originalUrl}
                </div>
                <div class="url-clicks">${Utils.formatClicks(url.clickCount)}</div>
                <div class="url-date">${Utils.formatDate(url.createdAt)}</div>
                <div class="url-actions">
                    <button class="btn btn-small btn-warning" onclick="adminPanel.editUrl('${url.shortCode}')">تعديل</button>
                    <button class="btn btn-small btn-danger" onclick="adminPanel.deleteUrl('${url.shortCode}')">حذف</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = urlsHTML;
    }

    // عرض أزرار الصفحات
    renderPagination(totalPages) {
        const container = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // زر الصفحة السابقة
        if (this.currentPage > 1) {
            paginationHTML += `<button class="btn btn-secondary" onclick="adminPanel.loadUrls(${this.currentPage - 1})">السابق</button>`;
        }

        // أرقام الصفحات
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === this.currentPage ? 'btn-primary' : 'btn-secondary';
            paginationHTML += `<button class="btn ${activeClass}" onclick="adminPanel.loadUrls(${i})">${i}</button>`;
        }

        // زر الصفحة التالية
        if (this.currentPage < totalPages) {
            paginationHTML += `<button class="btn btn-secondary" onclick="adminPanel.loadUrls(${this.currentPage + 1})">التالي</button>`;
        }

        container.innerHTML = paginationHTML;
    }

// تحميل الإحصائيات محسن
async loadStats() {
    try {
        // استخدام endpoint مخصص للإحصائيات
        const response = await fetch('/api/stats');
        const result = await response.json();

        if (result.success) {
            const stats = result.data;
            
            // عرض الإحصائيات
            document.getElementById('total-urls').textContent = stats.totalUrls;
            document.getElementById('total-clicks').textContent = Utils.formatClicks(stats.totalClicks);
            document.getElementById('today-urls').textContent = stats.todayUrls;
            document.getElementById('avg-clicks').textContent = stats.avgClicks;

            // عرض أكثر الروابط نقراً
            this.renderTopUrls(stats.topUrls);
        } else {
            throw new Error(result.error || 'فشل في تحميل الإحصائيات');
        }

    } catch (error) {
        console.error('Stats error:', error);
        AlertSystem.error('فشل في تحميل الإحصائيات: ' + error.message);
    }
}

    // عرض أكثر الروابط نقراً
    renderTopUrls(urls) {
        const container = document.getElementById('top-urls-list');
        
        if (!urls || urls.length === 0) {
            container.innerHTML = '<p>لا توجد بيانات</p>';
            return;
        }

        const urlsHTML = urls.map((url, index) => `
            <div class="top-url-item">
                <span class="rank">#${index + 1}</span>
                <div class="url-info">
                    <div class="short-url">/${url.shortCode}</div>
                    <div class="original-url">${url.originalUrl}</div>
                </div>
                <div class="clicks-count">${Utils.formatClicks(url.clickCount)} نقرة</div>
            </div>
        `).join('');

        container.innerHTML = urlsHTML;
    }

    // تعديل رابط
    async editUrl(shortCode) {
        const newUrl = prompt('أدخل الرابط الجديد:');
        
        if (!newUrl) return;

        if (!Utils.isValidUrl(newUrl)) {
            AlertSystem.error('الرابط الجديد غير صحيح');
            return;
        }

        try {
            await URLShortenerAPI.createOrUpdateUrl({
                action: 'update',
                shortCode: shortCode,
                newUrl: Utils.cleanUrl(newUrl),
                userType: 'admin'
            });

            AlertSystem.success('تم تحديث الرابط بنجاح');
            this.loadUrls();

        } catch (error) {
            AlertSystem.error(error.message || 'فشل في تحديث الرابط');
        }
    }

    // حذف رابط
    async deleteUrl(shortCode) {
        if (!confirm('هل أنت متأكد من حذف هذا الرابط؟')) {
            return;
        }

        try {
            await URLShortenerAPI.deleteUrl(shortCode);
            AlertSystem.success('تم حذف الرابط بنجاح');
            this.loadUrls();

        } catch (error) {
            AlertSystem.error(error.message || 'فشل في حذف الرابط');
        }
    }

    // البحث في الروابط
    handleSearch(query) {
        if (!query) {
            this.renderUrlsList();
            return;
        }

        const filteredUrls = this.urls.filter(url => 
            url.shortCode.toLowerCase().includes(query.toLowerCase()) ||
            url.originalUrl.toLowerCase().includes(query.toLowerCase())
        );

        const container = document.getElementById('urls-list');
        
        if (filteredUrls.length === 0) {
            container.innerHTML = '<div class="loading">لا توجد نتائج</div>';
            return;
        }

        const urlsHTML = filteredUrls.map(url => `
            <div class="url-row">
                <div class="url-short">
                    <a href="/${url.shortCode}" target="_blank">/${url.shortCode}</a>
                </div>
                <div class="url-original" title="${url.originalUrl}">
                    ${url.originalUrl.length > 60 ? url.originalUrl.substring(0, 60) + '...' : url.originalUrl}
                </div>
                <div class="url-clicks">${Utils.formatClicks(url.clickCount)}</div>
                <div class="url-date">${Utils.formatDate(url.createdAt)}</div>
                <div class="url-actions">
                    <button class="btn btn-small btn-warning" onclick="adminPanel.editUrl('${url.shortCode}')">تعديل</button>
                    <button class="btn btn-small btn-danger" onclick="adminPanel.deleteUrl('${url.shortCode}')">حذف</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = urlsHTML;
    }
}

// نسخ الرابط الجديد
function copyUrl() {
    const shortUrl = document.getElementById('new-short-url').textContent;
    Utils.copyToClipboard(shortUrl).then(success => {
        if (success) {
            AlertSystem.success('تم نسخ الرابط للحافظة');
        } else {
            AlertSystem.error('فشل في نسخ الرابط');
        }
    });
}

// عرض القسم
function showSection(sectionName) {
    if (window.adminPanel) {
        window.adminPanel.showSection(sectionName);
    }
}

// تهيئة لوحة الأدمن عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.adminPanel = new AdminPanel();
});