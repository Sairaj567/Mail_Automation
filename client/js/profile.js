document.addEventListener('DOMContentLoaded', () => {
	setupThemeToggle();

	const profileForm = document.getElementById('profileForm');
	const resetButton = document.getElementById('resetProfileBtn');
	const avatarButton = document.getElementById('changeAvatarBtn');
	const avatarInput = document.getElementById('profileImageInput');

	if (!profileForm) return;

	const initialFormData = new FormData(profileForm);

	if (resetButton) {
		resetButton.addEventListener('click', () => {
			for (const [fieldName, fieldValue] of initialFormData.entries()) {
				const input = profileForm.elements[fieldName];
				if (input) {
					input.value = fieldValue;
				}
			}
			showToast('Profile form reset.', 'info');
		});
	}

	if (avatarButton && avatarInput) {
		avatarButton.addEventListener('click', () => avatarInput.click());
		avatarInput.addEventListener('change', async () => {
			if (!avatarInput.files || !avatarInput.files[0]) return;
			const formData = new FormData();
			formData.append('profileImage', avatarInput.files[0]);

			try {
				const response = await fetch('/student/upload-profile-image', {
					method: 'POST',
					body: formData,
				});
				const data = await response.json();
				if (!response.ok || !data.success) {
					showToast(data.message || 'Failed to upload profile image.', 'error');
					return;
				}

				showToast(data.message || 'Profile image updated.', 'success');
				setTimeout(() => window.location.reload(), 700);
			} catch (error) {
				console.error('Profile image upload error:', error);
				showToast('Something went wrong while uploading image.', 'error');
			}
		});

		function setupThemeToggle() {
			if (document.querySelector('.theme-toggle-btn')) return;

			const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			const storedTheme = localStorage.getItem('theme');
			const initialTheme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : systemTheme;

			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'theme-toggle-btn';
			button.setAttribute('aria-label', 'Toggle dark mode');
			document.body.appendChild(button);

			const applyTheme = (theme) => {
				document.documentElement.dataset.theme = theme;
				localStorage.setItem('theme', theme);
				const isDark = theme === 'dark';
				button.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i><span>${isDark ? 'Light mode' : 'Dark mode'}</span>`;
				button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
			};

			applyTheme(initialTheme);
			button.addEventListener('click', () => {
				applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
			});
		}
	}

	profileForm.addEventListener('submit', async (event) => {
		event.preventDefault();

		const submitButton = profileForm.querySelector('button[type="submit"]');
		if (submitButton) {
			submitButton.disabled = true;
			submitButton.textContent = 'Saving...';
		}

		try {
			const payload = Object.fromEntries(new FormData(profileForm).entries());

			const response = await fetch('/student/update-profile', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				showToast(data.message || 'Failed to update profile.', 'error');
				return;
			}

			showToast(data.message || 'Profile updated successfully!', 'success');
			setTimeout(() => {
				window.location.reload();
			}, 800);
		} catch (error) {
			console.error('Profile update error:', error);
			showToast('Something went wrong while saving profile.', 'error');
		} finally {
			if (submitButton) {
				submitButton.disabled = false;
				submitButton.textContent = 'Save Changes';
			}
		}
	});
});

function showToast(message, type) {
	const existingToast = document.querySelector('.profile-toast');
	if (existingToast) existingToast.remove();

	const toast = document.createElement('div');
	toast.className = 'profile-toast';
	toast.textContent = message;
	toast.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 1200;
		color: #fff;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		font-weight: 500;
	`;

	if (type === 'success') {
		toast.style.background = '#10B981';
	} else if (type === 'error') {
		toast.style.background = '#EF4444';
	} else {
		toast.style.background = '#3B82F6';
	}

	document.body.appendChild(toast);
	setTimeout(() => toast.remove(), 3000);
}
