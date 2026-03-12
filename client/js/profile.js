document.addEventListener('DOMContentLoaded', () => {
	const profileForm = document.getElementById('profileForm');
	const resetButton = document.getElementById('resetProfileBtn');

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
