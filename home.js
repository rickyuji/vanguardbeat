const BAND_PASSWORDS = {
    'Borscht': 'borscht123',
    '愛知大学音楽研究会': 'aichidaigaku456',
    'Noah': 'noah456',
    'applause': 'applause123',
    'The Wake': 'wake789',
    'Libido': 'libido456',
    'WALABE': 'walabe2024',
    'やきそばvision': 'yakisoba2024',
    '花緑青': 'hanaroku2024',
    'La Plata Dolphin': 'laplata2024',
    'BANGER BUDGE': 'banger2024',
    'Lily of the valley': 'lilyvalley2024',
    'The Hidden Cat': 'hidden789',
    'OROKAMONO': 'orokamono2024',
};

const SESSION_KEY = 'borscht-current-band';
const RESERVATIONS_PAGE = 'reservations.html';

const openLoginBtn = document.getElementById('open-login');
const loginModal = document.getElementById('login-modal');
const loginCloseBtn = document.getElementById('login-close');
const loginSubmitBtn = document.getElementById('login-submit');
const loginBandInput = document.getElementById('login-band');
const loginPasswordInput = document.getElementById('login-password');
const loginMessage = document.getElementById('login-message');

function openModal() {
    loginMessage.textContent = '';
    loginModal.classList.remove('hidden');
    loginModal.classList.add('flex');
    loginBandInput.focus();
}

function closeModal() {
    loginModal.classList.add('hidden');
    loginModal.classList.remove('flex');
    loginPasswordInput.value = '';
    loginMessage.textContent = '';
}

function saveBandSession(bandName) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ band_name: bandName }));
}

function handleLogin() {
    const bandName = (loginBandInput.value || '').trim();
    const password = (loginPasswordInput.value || '').trim();

    if (!bandName || !password) {
        loginMessage.textContent = '両方の項目を入力してください';
        return;
    }

    const expected = BAND_PASSWORDS[bandName];
    if (!expected || expected !== password) {
        loginMessage.textContent = 'バンド名かパスワードが正しくありません';
        return;
    }

    saveBandSession(bandName);
    window.location.href = RESERVATIONS_PAGE;
}

window.addEventListener('DOMContentLoaded', () => {
    if (openLoginBtn) {
        openLoginBtn.addEventListener('click', openModal);
    }

    if (loginCloseBtn) {
        loginCloseBtn.addEventListener('click', closeModal);
    }

    if (loginModal) {
        loginModal.addEventListener('click', (event) => {
            if (event.target === loginModal) {
                closeModal();
            }
        });
    }

    if (loginSubmitBtn) {
        loginSubmitBtn.addEventListener('click', (event) => {
            event.preventDefault();
            handleLogin();
        });
    }

    if (loginBandInput && loginPasswordInput) {
        [loginBandInput, loginPasswordInput].forEach((input) => {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleLogin();
                }
            });
        });
    }
});
