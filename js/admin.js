document.addEventListener('DOMContentLoaded', () => {
    // ---- Auth Guard: Redirect to login if not authenticated ----
    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    // Show current user name if available
    const user = Auth.getUser();
    if (user && user.name) {
        const welcomeSpan = document.querySelector('.admin-header span[style*="font-weight"]');
        if (welcomeSpan) welcomeSpan.textContent = `Welcome, ${user.name}`;
    }

    // ---- Data Storage ----
    let courses = [];
    let sections = [];
    let laihas = [];
    let levels = [];

    // ---- Elements ----
    const adminTbody = document.getElementById('admin-tbody');
    const searchInput = document.getElementById('search-input');
    const filterReg   = document.getElementById('filter-reg');
    const filterLevel = document.getElementById('filter-level');
    const filterDept  = document.getElementById('filter-dept');
    
    // Modals
    const formModal = document.getElementById('form-modal');
    const deleteModal = document.getElementById('delete-modal');
    
    // Forms & Inputs
    const subjectForm = document.getElementById('subject-form');
    const subjectIdInput = document.getElementById('subject-id');
    const subjectNameInput = document.getElementById('subject-name');
    const subjectCodeInput = document.getElementById('subject-code');
    const subjectDateInput = document.getElementById('subject-date');
    const subjectDayInput = document.getElementById('subject-day');
    const subjectDeptInput = document.getElementById('subject-dept');
    const subjectRegInput = document.getElementById('subject-reg');
    
    // Delete target
    let currentDeleteId = null;

    // ---- Toast Notification ----
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' 
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--danger);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);
        
        // Trigger reflow for transition
        toast.offsetHeight; 
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // ============================================
    // Fetch ALL data from the real API
    // ============================================
    const fetchAllData = async () => {
        try {
            // Fetch courses, sections, laihas, and levels in parallel
            const [coursesRes, sectionsRes, laihasRes, levelsRes] = await Promise.all([
                apiFetch(API.COURSES),
                apiFetch(API.SECTIONS),
                apiFetch(API.LAIHAS),
                apiFetch(API.LEVELS),
            ]);

            if (coursesRes && coursesRes.ok) {
                const coursesData = await coursesRes.json();
                courses = Array.isArray(coursesData) ? coursesData : (coursesData.data || []);
                console.log('📦 Courses loaded:', courses.length, 'items');
                if (courses.length > 0) console.log('📦 Sample course:', courses[0]);
            } else {
                console.warn('⚠️ Courses fetch failed:', coursesRes?.status);
            }

            if (sectionsRes && sectionsRes.ok) {
                const sectionsData = await sectionsRes.json();
                sections = Array.isArray(sectionsData) ? sectionsData : (sectionsData.data || []);
                console.log('📦 Sections loaded:', sections.length, 'items');
                if (sections.length > 0) console.log('📦 Sample section:', sections[0]);
                populateSectionSelect();
            } else {
                console.warn('⚠️ Sections fetch failed:', sectionsRes?.status);
            }

            if (laihasRes && laihasRes.ok) {
                const laihasData = await laihasRes.json();
                laihas = Array.isArray(laihasData) ? laihasData : (laihasData.data || []);
                console.log('📦 Laihas loaded:', laihas.length, 'items');
                populateRegSelect();
                populateSectionFilter(); // populate regulation filter too
            } else {
                console.warn('⚠️ Laihas fetch failed:', laihasRes?.status);
            }

            if (levelsRes && levelsRes.ok) {
                const levelsData = await levelsRes.json();
                levels = Array.isArray(levelsData) ? levelsData : (levelsData.data || []);
                console.log('📦 Levels loaded:', levels.length, 'items');
            } else {
                console.warn('⚠️ Levels fetch failed:', levelsRes?.status);
            }

            renderTable();

        } catch (error) {
            console.error('Error fetching data:', error);
            showToast('Error loading data from server. الخطأ في تحميل البيانات', 'error');
        }
    };

    // ---- Populate Dropdowns from API Data ----
    const populateSectionFilter = () => {
        // Populate regulation filter from laihas
        filterReg.innerHTML = '<option value="all">كل اللوائح</option>';
        laihas.forEach(laiha => {
            const opt = document.createElement('option');
            opt.value = laiha.id;
            opt.textContent = laiha.name;
            filterReg.appendChild(opt);
        });
    };

    // When Regulation filter changes → populate Level filter
    const onFilterRegChange = () => {
        const regId = filterReg.value;
        filterLevel.innerHTML = '<option value="all">كل المستويات</option>';
        filterDept.innerHTML  = '<option value="all">كل الأقسام</option>';
        filterDept.disabled   = true;

        if (regId !== 'all') {
            const laiha = laihas.find(l => String(l.id) === String(regId));
            if (laiha && laiha.levels) {
                laiha.levels.forEach(lv => {
                    const opt = document.createElement('option');
                    opt.value = lv.id;
                    opt.textContent = lv.name;
                    filterLevel.appendChild(opt);
                });
            }
            filterLevel.disabled = false;
        } else {
            filterLevel.disabled = true;
        }
        renderTable();
    };

    // When Level filter changes → populate Department filter
    const onFilterLevelChange = () => {
        const levelId = parseInt(filterLevel.value);
        filterDept.innerHTML = '<option value="all">كل الأقسام</option>';

        if (filterLevel.value !== 'all') {
            const matchingSections = sections.filter(s => s.level && s.level.id === levelId);
            matchingSections.forEach(sec => {
                const opt = document.createElement('option');
                opt.value = sec.id;
                opt.textContent = sec.name.replace(/\u0640/g, '').trim();
                filterDept.appendChild(opt);
            });
            filterDept.disabled = false;
        } else {
            filterDept.disabled = true;
        }
        renderTable();
    };

    const populateSectionSelect = () => {
        // Fill the modal's Department <select>
        subjectDeptInput.innerHTML = '<option value="">Select Dept...</option>';
        sections.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.id;
            opt.textContent = sec.name;
            subjectDeptInput.appendChild(opt);
        });
    };

    const populateRegSelect = () => {
        // Fill the modal's Regulation <select>
        subjectRegInput.innerHTML = '<option value="">Select Reg...</option>';
        laihas.forEach(laiha => {
            const opt = document.createElement('option');
            opt.value = laiha.id;
            opt.textContent = laiha.name;
            subjectRegInput.appendChild(opt);
        });
    };

    // ---- Helper: Get name by ID ----
    const getSectionName = (course) => {
        // Try nested section object first (some APIs embed relations)
        if (course.section && course.section.name) return course.section.name;
        // Then try section_id lookup
        if (course.section_id) {
            const sec = sections.find(s => s.id == course.section_id);
            return sec ? sec.name : `#${course.section_id}`;
        }
        return '-';
    };
    const getLaihaName = (id) => {
        const l = laihas.find(la => la.id == id);
        return l ? l.name : (id || '-');
    };
    // Get time from the level (levels table has the time field)
    const getTimeFromLevel = (course) => {
        // First: try course.section.level.time (if API returns full nested data)
        if (course.section && course.section.level && course.section.level.time) {
            return course.section.level.time;
        }
        // Second: lookup section from our loaded sections array (which has level with time)
        const sectionId = (course.section && course.section.id) || course.section_id;
        if (sectionId) {
            const fullSection = sections.find(s => s.id == sectionId);
            if (fullSection && fullSection.level && fullSection.level.time) {
                return fullSection.level.time;
            }
        }
        return '-';
    };

    // ---- Render Table ----
    const renderTable = () => {
        const searchTerm  = searchInput.value.toLowerCase();
        const regFilter   = filterReg.value;    // laiha ID or 'all'
        const levelFilter = filterLevel.value;  // level ID or 'all'
        const deptFilter  = filterDept.value;   // section ID or 'all'

        // Build set of valid level IDs for the selected laiha
        let validLevelIds = null;
        if (regFilter !== 'all') {
            const laiha = laihas.find(l => String(l.id) === String(regFilter));
            if (laiha && laiha.levels) {
                validLevelIds = new Set(laiha.levels.map(lv => lv.id));
            }
        }

        const filtered = courses.filter(c => {
            const name = (c.course_name || '').toLowerCase();
            const code = (c.course_code || '').toLowerCase();
            const matchesSearch = name.includes(searchTerm) || code.includes(searchTerm);

            // Get this course's section from our sections array
            const courseSectionId = c.section_id || (c.section && c.section.id);

            // 1) Filter by department/section
            const matchesDept = deptFilter === 'all' || String(courseSectionId) === String(deptFilter);

            // 2) Filter by level (via section → level)
            let matchesLevel = true;
            if (levelFilter !== 'all') {
                const fullSec = sections.find(s => s.id == courseSectionId);
                matchesLevel = fullSec && fullSec.level && String(fullSec.level.id) === String(levelFilter);
            }

            // 3) Filter by regulation (via section → level → laiha's validLevelIds)
            let matchesReg = true;
            if (validLevelIds) {
                const fullSec = sections.find(s => s.id == courseSectionId);
                matchesReg = fullSec && fullSec.level && validLevelIds.has(fullSec.level.id);
            }

            return matchesSearch && matchesDept && matchesLevel && matchesReg;
        });

        adminTbody.innerHTML = '';
        
        if (filtered.length === 0) {
            adminTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No courses found - لا توجد مواد</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const tr = document.createElement('tr');
            // Get time from level (stored in levels table)
            const timeDisplay = getTimeFromLevel(item);
            tr.innerHTML = `
                <td><span class="subject-name">${item.course_name || '-'}</span><br><small style="color:var(--text-muted)">${item.course_code || ''}</small></td>
                <td>${item.date || '-'}</td>
                <td><span class="hall-badge">${item.day || '-'}</span></td>
                <td><span class="time-badge">${timeDisplay}</span></td>
                <td><span class="hall-badge">${getSectionName(item)}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="icon-btn edit-btn" data-id="${item.id}" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="icon-btn delete delete-btn" data-id="${item.id}" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </td>
            `;
            adminTbody.appendChild(tr);
        });

        // Attach listeners to dynamically created buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openFormModal(parseInt(e.currentTarget.dataset.id)));
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openDeleteModal(parseInt(e.currentTarget.dataset.id)));
        });
    };

    // Filter listeners
    searchInput.addEventListener('input', renderTable);
    filterReg.addEventListener('change', onFilterRegChange);
    filterLevel.addEventListener('change', onFilterLevelChange);
    filterDept.addEventListener('change', renderTable);

    // ============================================
    // Modals Logic (Add / Edit)
    // ============================================
    const openFormModal = (id = null) => {
        if (id) {
            const course = courses.find(c => c.id === id);
            if (!course) return;
            document.getElementById('modal-title').innerText = 'Edit Course - تعديل مادة';
            subjectIdInput.value = course.id;
            subjectNameInput.value = course.course_name || '';
            subjectCodeInput.value = course.course_code || '';
            subjectDateInput.value = course.date || '';
            subjectDayInput.value = course.day || '';
            subjectDeptInput.value = (course.section && course.section.id) || course.section_id || '';
            subjectRegInput.value = (course.laiha && course.laiha.id) || course.laiha_id || '';
        } else {
            document.getElementById('modal-title').innerText = 'Add New Course - إضافة مادة جديدة';
            subjectForm.reset();
            subjectIdInput.value = '';
        }
        formModal.classList.add('active');
    };

    const closeForm = () => formModal.classList.remove('active');

    document.getElementById('add-new-btn').addEventListener('click', () => openFormModal());
    document.getElementById('close-form-modal').addEventListener('click', closeForm);
    document.getElementById('cancel-form').addEventListener('click', closeForm);

    // ---- Save Course (Create or Update) ----
    subjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = subjectIdInput.value;
        
        // Build the request body matching the API spec
        const courseData = {
            section_id: parseInt(subjectDeptInput.value) || 1,
            course_name: subjectNameInput.value,
            course_code: subjectCodeInput.value,
            day: subjectDayInput.value,
            date: subjectDateInput.value,
        };

        try {
            let response;
            if (id) {
                // UPDATE existing course
                response = await apiFetch(`${API.COURSES}/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(courseData),
                });
            } else {
                // CREATE new course
                response = await apiFetch(API.COURSES, {
                    method: 'POST',
                    body: JSON.stringify(courseData),
                });
            }

            if (response && response.ok) {
                showToast(id ? 'Course updated successfully! ✅' : 'New course added successfully! ✅');
                closeForm();
                fetchAllData(); // Refresh data from server
            } else {
                const errData = await response.json().catch(() => ({}));
                const msg = errData.message || 'Failed to save course';
                showToast(`Error: ${msg}`, 'error');
            }

        } catch (error) {
            console.error(error);
            showToast('Error saving data to server', 'error');
        }
    });

    // ============================================
    // Delete Course
    // ============================================
    const openDeleteModal = (id) => {
        currentDeleteId = id;
        const course = courses.find(c => c.id === id);
        document.getElementById('delete-subject-name').innerText = course ? course.course_name : 'this course';
        deleteModal.classList.add('active');
    };

    const closeDelete = () => {
        deleteModal.classList.remove('active');
        currentDeleteId = null;
    };

    document.getElementById('close-delete-modal').addEventListener('click', closeDelete);
    document.getElementById('cancel-delete').addEventListener('click', closeDelete);
    
    document.getElementById('confirm-delete').addEventListener('click', async () => {
        try {
            const response = await apiFetch(`${API.COURSES}/${currentDeleteId}`, {
                method: 'DELETE',
            });

            if (response && response.ok) {
                showToast('Course deleted successfully! ✅');
                closeDelete();
                fetchAllData(); // Refresh data from server
            } else {
                showToast('Error deleting course', 'error');
            }

        } catch (error) {
            console.error(error);
            showToast('Error deleting course', 'error');
        }
    });

    // ============================================
    // Logout
    // ============================================
    const logoutLink = document.querySelector('.nav-item[href="index.html"]:last-of-type') 
                    || document.querySelector('a.nav-item:has(polyline[points="16 17 21 12 16 7"])');
    
    // Find logout button (the one with Logout text)
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.textContent.trim().includes('Logout')) {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await apiFetch(API.LOGOUT, { method: 'DELETE' });
                } catch (err) {
                    console.error('Logout error:', err);
                }
                Auth.clear();
                window.location.href = 'login.html';
            });
        }
    });

    // ---- Tab Switching ----
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = e.currentTarget.dataset.tab;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            views.forEach(view => {
                view.style.display = view.id === `view-${tabId}` ? 'block' : 'none';
            });
            
            // Close mobile sidebar if open
            document.getElementById('sidebar').classList.remove('open');
        });
    });

    // ---- Mobile Sidebar ----
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // ---- File Upload Logic ----
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const importPreview = document.getElementById('import-preview');
    const previewTbody = document.getElementById('preview-tbody');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    // ---- parsedRows: holds rows parsed from Excel ----
    let parsedRows = [];

    const handleFile = async (file) => {
        if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
            showToast('صيغة الملف غير مدعومة. يرجى رفع xlsx أو csv.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // Get raw rows as arrays (no header row assumed - skip row 1 if it's a header)
                const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                // Detect if first row is header (if col E doesn't look like a course name)
                let startRow = 0;
                if (rawRows.length > 0) {
                    const firstCell = String(rawRows[0][0] || '');
                    // If first row contains Arabic header keywords, skip it
                    if (firstCell.includes('لائحة') || firstCell.includes('اللائحة') || firstCell.toLowerCase().includes('regulation')) {
                        startRow = 1;
                    }
                }

                parsedRows = [];
                for (let i = startRow; i < rawRows.length; i++) {
                    const row = rawRows[i];
                    // Skip completely empty rows
                    if (!row[4] && !row[5]) continue;

                    // Column mapping:
                    // A=0:اللائحة, B=1:البرنامج, C=2:المستوى, D=3:الشعبة
                    // E=4:اسم المقرر, F=5:كود المقرر, G=6:اليوم, H=7:التاريخ
                    const laihaName   = String(row[0] || '').trim();
                    const levelName   = String(row[2] || '').trim();
                    const sectionName = String(row[3] || '').trim().replace(/\u0640/g, ''); // strip Tatweel
                    const courseName  = String(row[4] || '').trim();
                    const courseCode  = String(row[5] || '').trim();
                    const day         = String(row[6] || '').trim();
                    let   date        = row[7];

                    // Format date
                    if (date instanceof Date) {
                        const d = date;
                        date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    } else {
                        date = String(date || '').trim();
                        // Try to parse M/D/YYYY
                        const parts = date.split('/');
                        if (parts.length === 3) {
                            const [m, d, y] = parts;
                            date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                        }
                    }

                    // Look up section ID: laiha → level → section
                    let sectionId = null;
                    let status    = '✅ جاهز';

                    if (!courseName) { status = '⚠️ اسم المادة مفقود'; }
                    else {
                        // Find laiha
                        const laiha = laihas.find(l => l.name === laihaName);
                        if (!laiha) {
                            status = `❌ لائحة غير موجودة: "${laihaName}"`;
                        } else {
                            // Find level within laiha
                            const level = laiha.levels && laiha.levels.find(lv => lv.name === levelName);
                            if (!level) {
                                status = `❌ مستوى غير موجود: "${levelName}"`;
                            } else {
                                // Find section matching this level
                                const sec = sections.find(s =>
                                    s.level && s.level.id === level.id &&
                                    s.name.replace(/\u0640/g, '').trim() === sectionName
                                );
                                if (!sec) {
                                    status = `❌ شعبة غير موجودة: "${sectionName}"`;
                                } else {
                                    sectionId = sec.id;
                                }
                            }
                        }
                    }

                    parsedRows.push({ laihaName, levelName, sectionName, courseName, courseCode, day, date, sectionId, status });
                }

                // Show preview
                previewTbody.innerHTML = '';
                parsedRows.forEach((r, idx) => {
                    const tr = document.createElement('tr');
                    const isOk = r.sectionId !== null && r.courseName;
                    tr.style.background = isOk ? '' : '#fff5f5';
                    tr.innerHTML = `
                        <td>${idx + 1}</td>
                        <td>${r.courseName || '-'}</td>
                        <td><small>${r.courseCode || '-'}</small></td>
                        <td>${r.day || '-'}</td>
                        <td>${r.date || '-'}</td>
                        <td><small>${r.sectionName}</small></td>
                        <td style="font-size:0.8rem;">${r.status}</td>
                    `;
                    previewTbody.appendChild(tr);
                });

                const validCount = parsedRows.filter(r => r.sectionId !== null && r.courseName).length;
                document.getElementById('preview-count').textContent = `${validCount} صف صالح من ${parsedRows.length}`;
                importPreview.style.display = 'block';
                uploadArea.style.display = 'none';

            } catch (err) {
                console.error('Excel parse error:', err);
                showToast('خطأ في قراءة الملف. تأكد أن الملف سليم.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    document.getElementById('cancel-import').addEventListener('click', () => {
        fileInput.value = '';
        parsedRows = [];
        importPreview.style.display = 'none';
        document.getElementById('import-progress').style.display = 'none';
        uploadArea.style.display = 'block';
    });

    document.getElementById('confirm-import').addEventListener('click', async () => {
        const validRows = parsedRows.filter(r => r.sectionId !== null && r.courseName);
        if (validRows.length === 0) {
            showToast('لا توجد صفوف صالحة للاستيراد.', 'error');
            return;
        }

        // Show progress
        importPreview.style.display = 'none';
        const progressDiv    = document.getElementById('import-progress');
        const progressBar    = document.getElementById('progress-bar');
        const progressCount  = document.getElementById('progress-count');
        const progressLabel  = document.getElementById('progress-label');
        const progressErrors = document.getElementById('progress-errors');
        progressDiv.style.display = 'block';
        progressErrors.textContent = '';

        let done = 0, failed = 0;
        const errors = [];

        try {
            const payload = validRows.map(row => ({
                course_name: row.courseName,
                course_code: row.courseCode,
                day:         row.day,
                date:        row.date,
                section_id:  row.sectionId,
            }));

            const res = await apiFetch(API.IMPORT_COURSES, {
                method: 'POST',
                body: JSON.stringify({ courses: payload })
            });

            if (res && res.ok) {
                done = validRows.length;
                progressBar.style.width = '100%';
                progressCount.textContent = `${done} / ${validRows.length}`;
            } else {
                failed = validRows.length;
                errors.push(`❌ فشل الاستيراد بالكامل (${res?.status})`);
                const errData = await res.json().catch(() => ({}));
                if (errData.message) errors.push(errData.message);
            }
        } catch (err) {
            failed = validRows.length;
            errors.push(`❌ خطأ في الاتصال بالخادم`);
            console.error(err);
        }

        progressLabel.textContent = done > 0 ? `✅ تم استيراد ${done} مادة بنجاح` : 'انتهى الاستيراد';
        if (errors.length > 0) {
            progressErrors.innerHTML = errors.join('<br>');
        }
        if (done > 0) {
            showToast(`تم استيراد ${done} مادة بنجاح!`, 'success');
            await fetchAllData(); // refresh table
        }
        fileInput.value = '';
        parsedRows = [];
    });

    // ============================================
    // Initial Data Load
    // ============================================
    fetchAllData();
});
