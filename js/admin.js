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

    const handleFile = async (file) => {
        if (!file.name.match(/\.(csv|xlsx)$/i)) {
            showToast('Invalid file format. Please upload CSV or Excel.', 'error');
            return;
        }
        showToast('File upload feature will be available once the backend supports it.', 'error');
    };

    document.getElementById('cancel-import').addEventListener('click', () => {
        fileInput.value = '';
        importPreview.style.display = 'none';
        uploadArea.style.display = 'block';
    });

    document.getElementById('confirm-import').addEventListener('click', async () => {
        showToast('Import confirmation will work once the backend supports batch import.', 'error');
    });

    // ============================================
    // Initial Data Load
    // ============================================
    fetchAllData();
});
