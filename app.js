// ==========================================
// 1. ADD YOUR SUPABASE CREDENTIALS HERE
// ==========================================
const supabaseUrl = 'https://eowqvyalmhvxdiuxvmgn.supabase.co'; // e.g. https://xyz.supabase.co
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvd3F2eWFsbWh2eGRpdXh2bWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTg0NzUsImV4cCI6MjA5ODIzNDQ3NX0.H8MWhv996LK5g-ixvVuZ3KS4PRMtIY3RSuzeXlWJR3Q';

// Initialize Supabase Client (use global `supabase` provided by the CDN)
const supabaseClient = (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(supabaseUrl, supabaseKey)
    : null;

// Application state
let bandsList = [];
let currentBand = null; // { id, band_name }

const SESSION_KEY = 'borscht-current-band';
const HOME_PAGE_URL = 'index.html';

const appRoot = document.getElementById('app-root');
const loginStatus = document.getElementById('login-status');
const cashbackDisplay = document.getElementById('cashback-display');
const cashbackAmount = document.getElementById('cashback-amount');
const logoutBtn = document.getElementById('logout-btn');

// UI Elements
const form = document.getElementById('reservation-form');
const guestNameInput = document.getElementById('guest-name');
const ticketCountInput = document.getElementById('ticket-count');
const statusMessage = document.getElementById('status-message');
const reservationsBody = document.getElementById('reservations-body');
const submitBtn = document.getElementById('submit-btn');
const refreshBtn = document.getElementById('refresh-btn');
const exportBtn = document.getElementById('export-btn');

// Only this band name is allowed to see/use the export-to-Excel feature.
const EXPORT_ALLOWED_BAND = 'Borscht';

// Show/hide the export button explicitly, without relying on a Tailwind
// responsive utility (e.g. `sm:inline-flex`) baked into the HTML — those
// rules win over a JS-toggled `hidden` class at their breakpoint and made
// the button appear for every band. We toggle both `hidden` and the
// display class here so visibility is fully controlled from JS.
function setExportButtonVisibility(isVisible) {
    exportBtn.classList.toggle('hidden', !isVisible);
    exportBtn.classList.toggle('inline-flex', isVisible);
}

function loadCurrentBandFromSession() {
    try {
        const storedBand = sessionStorage.getItem(SESSION_KEY);
        if (!storedBand) {
            return null;
        }

        const parsedBand = JSON.parse(storedBand);
        if (!parsedBand?.band_name) {
            return null;
        }

        return parsedBand;
    } catch (err) {
        console.error('Error loading band session:', err);
        return null;
    }
}

function requireBandSession() {
    const storedBand = loadCurrentBandFromSession();
    if (!storedBand) {
        window.location.href = HOME_PAGE_URL;
        return null;
    }

    return storedBand;
}

// Helper to show status messages smoothly
function showMessage(text, isError = false) {
    statusMessage.textContent = text;
    statusMessage.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');
    
    if (isError) {
        statusMessage.classList.add('bg-red-100', 'text-red-800');
    } else {
        statusMessage.classList.add('bg-green-100', 'text-green-800');
    }
    
    // Hide after 3 seconds
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
}

// ==========================================
// 2. FETCH BANDS FOR THE DROPDOWN
// ==========================================
async function fetchBands() {
    if (!supabaseClient) {
        console.error('Supabase client is not available. Make sure the CDN script is included before app.js.');
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('bands').select('*').order('band_name');
        
        if (error) throw error;

        bandsList = data || [];
    } catch (err) {
        console.error("Error fetching bands:", err);
    }
}

// ==========================================
// 3. FETCH AND DISPLAY RESERVATIONS
// ==========================================
async function fetchReservations() {
    if (!currentBand) {
        reservationsBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">ログインしてください</td></tr>';
        if (cashbackAmount) {
            cashbackAmount.textContent = '¥0';
        }
        return;
    }

    try {
        reservationsBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">読み込み中...</td></tr>';
        
        // Fetch reservations and join with the bands table to get the band name
        if (!supabaseClient) {
            reservationsBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">サーバー接続がありません</td></tr>';
            console.error('Supabase client is not available.');
            return;
        }

        let query = supabaseClient
            .from('reservations')
            .select(`
                id,
                guest_name,
                ticket_count,
                band_id,
                bands ( band_name )
            `)
            .order('created_at', { ascending: false });

        query = query.eq('band_id', currentBand.id);

        const { data, error } = await query;

        if (error) throw error;

        reservationsBody.innerHTML = '';

        const totalTickets = (data || []).reduce((sum, reservation) => sum + Number(reservation.ticket_count || 0), 0);
        const cashbackValue = totalTickets >= 3 ? (totalTickets - 2) * 700 : 0;

        if (cashbackAmount) {
            cashbackAmount.textContent = `¥${cashbackValue.toLocaleString()}`;
        }
        
        if (data.length === 0) {
            reservationsBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">取り置きはまだありません</td></tr>';
            return;
        }

        data.forEach(res => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';
            tr.innerHTML = `
                <td class="p-3 font-medium">${escapeHTML(res.guest_name)}</td>
                <td class="p-3 text-center">
                    <span class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold">
                        ${res.ticket_count}
                    </span>
                </td>
            `;

            // Actions column: delete button for own reservations, otherwise empty cell
            const actionTd = document.createElement('td');
            actionTd.className = 'p-3 text-right';
            if (currentBand && res.band_id === currentBand.id) {
                const del = document.createElement('button');
                del.className = 'text-sm text-red-600 hover:text-red-800';
                del.textContent = 'Delete';
                del.addEventListener('click', () => deleteReservation(res.id));
                actionTd.appendChild(del);
            }
            tr.appendChild(actionTd);
            reservationsBody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error fetching reservations:", err);
        reservationsBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">データの取得に失敗しました</td></tr>';
    }
}

// Delete a reservation by id (only allowed for the logged band's reservations)
async function deleteReservation(id) {
    if (!currentBand) return;
    if (!confirm('この取り置きを削除しますか？')) return;

    try {
        const { error } = await supabaseClient.from('reservations').delete().eq('id', id);
        if (error) throw error;
        showMessage('取り置きを削除しました。');
        fetchReservations();
    } catch (err) {
        console.error('Error deleting reservation:', err);
        showMessage('削除に失敗しました', true);
    }
}

// ==========================================
// 4. SUBMIT NEW RESERVATION
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const guestName = guestNameInput.value.trim();
    const ticketCount = parseInt(ticketCountInput.value, 10);
    const katakanaNamePattern = /^[ァ-ヶー]+　[ァ-ヶー]+$/;

    if (!currentBand || !guestName || !ticketCount) {
        showMessage('すべての項目を入力してください', true);
        return;
    }

    if (!katakanaNamePattern.test(guestName)) {
        showMessage('お名前はカタカナで、全角スペースを1つ入れて入力してください', true);
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';

    try {
        if (!supabaseClient) {
            showMessage('サーバー接続がありません', true);
            console.error('Supabase client is not available.');
            return;
        }
        const { error } = await supabaseClient
            .from('reservations')
            .insert([
                { band_id: currentBand.id, guest_name: guestName, ticket_count: ticketCount }
            ]);

        if (error) throw error;

        // Success
        showMessage('取り置きを追加しました！');
        guestNameInput.value = '';
        ticketCountInput.value = '1';
        
        // Refresh the table
        fetchReservations();
    } catch (err) {
        console.error("Error inserting data:", err);
        showMessage('エラーが発生しました', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '追加する';
    }
});

// Basic HTML escaper to prevent XSS attacks when displaying names
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function sanitizeSheetName(name) {
    const baseName = String(name || 'Banda')
        .replace(/[\\/?*\[\]:]/g, '_')
        .replace(/^'+|'+$/g, '')
        .trim();

    return (baseName || 'Banda').slice(0, 31);
}

function createUniqueSheetName(name, usedNames) {
    const baseName = sanitizeSheetName(name);
    let candidate = baseName;
    let suffix = 1;

    while (usedNames.has(candidate)) {
        const suffixText = `_${suffix}`;
        candidate = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
        suffix += 1;
    }

    usedNames.add(candidate);
    return candidate;
}

async function exportReservationsToExcel() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase client is not available.');
        }

        if (!currentBand || currentBand.band_name !== EXPORT_ALLOWED_BAND) {
            throw new Error(`Export is only available for ${EXPORT_ALLOWED_BAND}.`);
        }

        if (typeof window.XLSX === 'undefined') {
            throw new Error('SheetJS is not loaded.');
        }

        exportBtn.disabled = true;
        exportBtn.textContent = 'ダウンロード中';

        const { data, error } = await supabaseClient
            .from('reservations')
            .select(`
                id,
                guest_name,
                ticket_count,
                band_id,
                bands ( band_name )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const groupedReservations = new Map();

        (data || []).forEach((reservation) => {
            const bandName = reservation.bands?.band_name || 'バンドなし';
            if (!groupedReservations.has(bandName)) {
                groupedReservations.set(bandName, []);
            }
            groupedReservations.get(bandName).push(reservation);
        });

        if (groupedReservations.size === 0) {
            throw new Error('データがありません');
        }

        const workbook = window.XLSX.utils.book_new();
        const usedSheetNames = new Set();

        for (const [bandName, reservations] of groupedReservations.entries()) {
            const totalTickets = reservations.reduce((sum, reservation) => sum + Number(reservation.ticket_count || 0), 0);
            const rows = [[
                '名前',
                '枚数',
                '枚数合計'
            ]];

            reservations.forEach((reservation, index) => {
                rows.push([
                    reservation.guest_name || '',
                    reservation.ticket_count ?? '',
                    index === 0 ? totalTickets : ''
                ]);
            });

            const worksheet = window.XLSX.utils.aoa_to_sheet(rows);
            const sheetName = createUniqueSheetName(bandName, usedSheetNames);
            window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }

        window.XLSX.writeFile(workbook, 'Vanguard_Borscht_Beat.xlsx');
    } catch (err) {
        console.error('Error exporting reservations:', err);
        showMessage('エクスポートに失敗しました', true);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'エクセル';
    }
}

// Event Listeners for initialization and manual refresh
refreshBtn.addEventListener('click', fetchReservations);
exportBtn.addEventListener('click', exportReservationsToExcel);

window.addEventListener('DOMContentLoaded', () => {
    const storedBand = requireBandSession();
    if (!storedBand) {
        return;
    }

    // fetch bands first so any band-related reads stay consistent
    fetchBands().then(() => {
        currentBand = bandsList.find((band) => band.band_name === storedBand.band_name) || null;

        if (!currentBand) {
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = HOME_PAGE_URL;
            return;
        }

        appRoot.classList.remove('hidden');
        loginStatus.textContent = `${currentBand.band_name}`;
        cashbackDisplay.classList.remove('hidden');
        setExportButtonVisibility(currentBand.band_name === EXPORT_ALLOWED_BAND);
        logoutBtn.classList.remove('hidden');
        fetchReservations();
    });

    logoutBtn.addEventListener('click', () => {
        currentBand = null;
        loginStatus.textContent = '';
        cashbackAmount.textContent = '¥0';
        cashbackDisplay.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        setExportButtonVisibility(false);
        guestNameInput.value = '';
        ticketCountInput.value = '1';
        reservationsBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">ログインしてください</td></tr>';
        appRoot.classList.add('hidden');
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = HOME_PAGE_URL;
    });
});