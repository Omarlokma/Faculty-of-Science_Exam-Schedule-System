document.addEventListener('DOMContentLoaded', () => {
    const showBtn = document.getElementById('show-schedule-btn');
    const academicLevel = document.getElementById('academic-level');
    const department = document.getElementById('department');
    const regulation = document.getElementById('regulation');
    
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const scheduleContainer = document.getElementById('schedule-container');
    const scheduleBody = document.getElementById('schedule-body');

    // Shared headers for all API calls
    const getHeaders = () => {
        const h = { 'Accept': 'application/json', 'ngrok-skip-browser-warning': 'true' };
        const token = localStorage.getItem('auth_token');
        if (token) h['Authorization'] = `Bearer ${token}`;
        return h;
    };

    // Cache for laihas and sections data
    let laihasCache = null;
    let sectionsCache = null;

    // Pre-load laihas & sections data on page load
    const preloadData = async () => {
        try {
            const [lRes, sRes] = await Promise.all([
                fetch(API.LAIHAS, { headers: getHeaders() }),
                fetch(API.SECTIONS, { headers: getHeaders() })
            ]);
            if (lRes.ok) {
                const d = await lRes.json();
                laihasCache = Array.isArray(d) ? d : (d.data || []);
            }
            if (sRes.ok) {
                const d = await sRes.json();
                sectionsCache = Array.isArray(d) ? d : (d.data || []);
            }
        } catch (e) {
            console.warn('Preload failed:', e);
        }
    };
    preloadData();

    // ============================================
    // Cascading Dropdowns Logic
    // ============================================

    // 1) When Regulation changes → Enable Level, Reset Department
    regulation.addEventListener('change', () => {
        if (regulation.value) {
            academicLevel.disabled = false;
            academicLevel.value = '';
            academicLevel.options[0].textContent = ' اختر المستوى ';

            // Populate levels based on selected laiha
            // Remove old dynamic options (keep option[0])
            while (academicLevel.options.length > 1) academicLevel.remove(1);

            const selectedLaiha = laihasCache && laihasCache.find(l => l.name === regulation.value);
            if (selectedLaiha && selectedLaiha.levels) {
                selectedLaiha.levels.forEach(lv => {
                    const opt = document.createElement('option');
                    opt.value = lv.id;           // Use level ID as value!
                    opt.textContent = lv.name;
                    academicLevel.appendChild(opt);
                });
            }
        } else {
            academicLevel.disabled = true;
            academicLevel.value = '';
            academicLevel.options[0].textContent = 'اختر أولاً اللائحة ';
        }
        // Always reset Department when Regulation changes
        department.disabled = true;
        department.value = '';
        department.innerHTML = '<option value=""> اختر أولاً المستوى </option>';
    });

    // 2) When Level changes → Enable Department & populate with sections from API
    academicLevel.addEventListener('change', () => {
        if (academicLevel.value) {
            const selectedLevelId = parseInt(academicLevel.value);

            // Filter sections from cache that belong to this level
            const matchingSections = sectionsCache
                ? sectionsCache.filter(s => s.level && s.level.id === selectedLevelId)
                : [];

            // Clear and populate department dropdown with section ID as value
            department.innerHTML = '<option value="">اختر القسم / الشعبة </option>';
            matchingSections.forEach(sec => {
                const opt = document.createElement('option');
                opt.value = sec.id;              // Use section ID as value!
                opt.textContent = sec.name.replace(/\u0640/g, '').trim(); // strip Tatweel for display
                department.appendChild(opt);
            });

            department.disabled = false;
        } else {
            department.disabled = true;
            department.value = '';
            department.innerHTML = '<option value=""> اختر أولاً المستوى </option>';
        }
    });

    // ============================================
    // Format Date Helper
    // ============================================
    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('ar-EG', options);
    };

    // ============================================
    // Show Schedule Button
    // ============================================
    showBtn.addEventListener('click', async () => {
        // Validate all 3 selections
        if (!regulation.value) {
            alert('من فضلك اختر اللائحة أولاً');
            return;
        }
        if (!academicLevel.value) {
            alert('من فضلك اختر المستوى');
            return;
        }
        if (!department.value) {
            alert('من فضلك اختر القسم / الشعبة');
            return;
        }

        // UI Transition
        emptyState.style.display = 'none';
        scheduleContainer.style.display = 'none';
        scheduleContainer.classList.remove('visible');
        loader.style.display = 'block';

        try {
            // Fetch courses, sections, AND laihas in parallel
            const headers = {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            };
            const token = localStorage.getItem('auth_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const [coursesResponse, sectionsResponse, laihasResponse] = await Promise.all([
                fetch(API.COURSES, { headers }),
                fetch(API.SECTIONS, { headers }),
                fetch(API.LAIHAS, { headers })
            ]);
            
            if (!coursesResponse || !coursesResponse.ok) {
                throw new Error('Network response was not ok');
            }
            
            const allCourses = await coursesResponse.json();
            const coursesArray = Array.isArray(allCourses) ? allCourses : (allCourses.data || []);

            // Load sections (which contain level with time)
            let sectionsArray = [];
            if (sectionsResponse && sectionsResponse.ok) {
                const allSections = await sectionsResponse.json();
                sectionsArray = Array.isArray(allSections) ? allSections : (allSections.data || []);
            }

            // Load laihas
            let laihasArray = [];
            if (laihasResponse && laihasResponse.ok) {
                const allLaihas = await laihasResponse.json();
                laihasArray = Array.isArray(allLaihas) ? allLaihas : (allLaihas.data || []);
            }

            // Helper: get time from level via sections lookup
            const getTime = (course) => {
                if (course.section && course.section.level && course.section.level.time) {
                    return course.section.level.time;
                }
                const secId = (course.section && course.section.id) || course.section_id;
                if (secId) {
                    const fullSec = sectionsArray.find(s => s.id == secId);
                    if (fullSec && fullSec.level && fullSec.level.time) return fullSec.level.time;
                }
                return '-';
            };
            
            // Filter courses by section ID + level ID (no text comparison = no Tatweel issues)
            const selectedSectionId = parseInt(department.value);  // section ID from dropdown
            const selectedReg = regulation.value;                   // e.g. "جديدة"

            // Build set of valid level IDs for the selected regulation+level
            const selectedLaiha = laihasArray.find(l => l.name === selectedReg);
            const validLevelIds = new Set();
            if (selectedLaiha && selectedLaiha.levels) {
                // academicLevel.value is now the level ID from the laiha
                const selectedLevelId = parseInt(academicLevel.value);
                // If level ID matches directly, add it
                if (selectedLevelId) validLevelIds.add(selectedLevelId);
            }

            console.log(`🔍 Filter: SectionID=${selectedSectionId}, LevelIDs=`, [...validLevelIds]);

            const filteredCourses = coursesArray.filter(course => {
                // 1) Match section ID exactly
                const courseSectionId = (course.section && course.section.id) || course.section_id;
                if (courseSectionId != selectedSectionId) return false;
                
                // 2) Match level ID from the correct laiha
                const fullSec = sectionsArray.find(s => s.id == courseSectionId);
                if (!fullSec || !fullSec.level) return false;
                
                // Check that this section's level ID is in the valid set for selected laiha+level
                if (validLevelIds.size > 0 && !validLevelIds.has(fullSec.level.id)) return false;
                
                return true;
            });
            
            loader.style.display = 'none';
            
            if (!filteredCourses || filteredCourses.length === 0) {
                emptyState.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <h3>لا يوجد جدول</h3>
                    <p>لا توجد امتحانات مجدولة لهذا الاختيار حالياً.<br>No schedule found for this selection.</p>
                `;
                emptyState.style.display = 'flex';
                return;
            }

            // Render Table
            scheduleBody.innerHTML = '';
            filteredCourses.forEach(item => {
                const tr = document.createElement('tr');
                const timeDisplay = getTime(item);
                tr.innerHTML = `
                    <td data-label="اسم المادة"><span class="subject-name">${item.course_name || '-'}</span><br><small style="color:var(--text-muted)">${item.course_code || ''}</small></td>
                    <td data-label="التاريخ">${item.date ? formatDate(item.date) : '-'}</td>
                    <td data-label="اليوم">${item.day || '-'}</td>
                    <td data-label="الساعة"><span class="time-badge">${timeDisplay}</span></td>
                `;
                scheduleBody.appendChild(tr);
            });

            scheduleContainer.style.display = 'block';
            
            // Trigger animation
            setTimeout(() => {
                scheduleContainer.classList.add('visible');
            }, 10);

        } catch (error) {
            console.error('Error fetching schedule:', error);
            loader.style.display = 'none';
            emptyState.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--danger);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <h3 style="color: var(--danger);">خطأ في تحميل البيانات</h3>
                <p>حدثت مشكلة في الاتصال بالسيرفر. حاول مرة أخرى لاحقاً.<br>Error connecting to server.</p>
            `;
            emptyState.style.display = 'flex';
        }
    });
});
