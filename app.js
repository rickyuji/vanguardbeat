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

// Predefined passwords for bands. Update these values to match your bands.
// Key: exact `band_name` as stored in the `bands` table. Value: password string.
const PREDEFINED_PASSWORDS = {
    'Borscht': 'borscht123',
    'Nóah': 'noah456',
    'The Hidden Cat': 'hidden789',
    'やきそばvision': 'yakisoba2024',
    '花緑青': 'hanaroku2024',
    'ØROKAMONO': 'orokamono2024',
    'WALABE': 'walabe2024',
    'La Plata Dolphins': 'laplata2024',
    'Lily of the valley': 'lilyvalley2024',
    'applause': 'applause2024'
};

// Login-related elements
const loginScreen = document.getElementById('login-screen');
const loginBandInput = document.getElementById('login-band');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginMessage = document.getElementById('login-message');
const appRoot = document.getElementById('app-root');
const loginStatus = document.getElementById('login-status');
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
        return;
    }

    try {
        reservationsBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">読み込み中... (Loading)</td></tr>';
        
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
    if (!confirm('この予約を削除しますか？')) return;

    try {
        const { error } = await supabaseClient.from('reservations').delete().eq('id', id);
        if (error) throw error;
        showMessage('予約を削除しました。');
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
        showMessage('予約を追加しました！');
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

        if (!currentBand || currentBand.band_name !== 'Borscht') {
            throw new Error('Export is only available for Borscht.');
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
        exportBtn.textContent = 'エクセルをエクスポート';
    }
}

// Event Listeners for initialization and manual refresh
refreshBtn.addEventListener('click', fetchReservations);
exportBtn.addEventListener('click', exportReservationsToExcel);

window.addEventListener('DOMContentLoaded', () => {
    // fetch bands first so login can validate band names
    fetchBands().then(() => fetchReservations());

    // Login handlers
    loginBtn.addEventListener('click', async () => {
        const bandName = (loginBandInput.value || '').trim();
        const password = (loginPasswordInput.value || '').trim();
        loginMessage.textContent = '';

        if (!bandName || !password) {
            loginMessage.textContent = '両方の項目を入力してください';
            return;
        }

        // Find band by exact name (case-sensitive). You can adjust this behavior.
        const band = bandsList.find(b => b.band_name === bandName);
        if (!band) {
            loginMessage.textContent = 'バンドが見つかりません';
            return;
        }

        const expected = PREDEFINED_PASSWORDS[band.band_name];
        if (!expected || expected !== password) {
            loginMessage.textContent = 'パスワードが正しくありません';
            return;
        }

        // Success
        currentBand = band;
        loginScreen.classList.add('hidden');
        appRoot.classList.remove('hidden');
        loginStatus.textContent = `${currentBand.band_name}`;
        exportBtn.classList.toggle('hidden', currentBand.band_name !== 'Borscht');
        logoutBtn.classList.remove('hidden');
        await fetchReservations();
    });

    logoutBtn.addEventListener('click', () => {
        currentBand = null;
        loginStatus.textContent = '';
        logoutBtn.classList.add('hidden');
        exportBtn.classList.add('hidden');
        guestNameInput.value = '';
        ticketCountInput.value = '1';
        reservationsBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">ログインしてください</td></tr>';
        appRoot.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginPasswordInput.value = '';
    });
});