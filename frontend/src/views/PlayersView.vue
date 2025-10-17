<script setup>
import { ref, onMounted } from 'vue';
import  api  from '../services/api'; // Giả sử bạn export api từ service

// === STATE MANAGEMENT ===
// Các biến trạng thái, tái tạo lại từ player-manager.js
const players = ref([]);
const isLoading = ref(true);
const isEditMode = ref(false);
const editingPlayerId = ref(null);

// State cho form, khớp với tất cả các trường trong DB và form HTML
const formState = ref({
    name: '',
    gender: 'Nam',
    type: 'Vãng lai',
    contact_info: '',
    skill_level: 3.0,
});

// State cho modal chi tiết
const isModalVisible = ref(false);
const selectedPlayer = ref(null);

// State cho việc hiển thị các trường nâng cao trong form
const showAdvanced = ref(false);


// === HELPER FUNCTIONS ===
// Giữ lại các hàm tiện ích
const getAvatarInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
};

const formatDate = (dateString) => {
    if (!dateString) return 'Chưa có';
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleString('vi-VN', options);
};

// === API & LOGIC METHODS ===

// Lấy danh sách người chơi, tương đương fetchAndRenderPlayers
async function fetchPlayers() {
    try {
        isLoading.value = true;
        // API trả về trực tiếp một mảng player
        const response = await api.getPlayers(); 
        players.value = response.data;
    } catch (error) {
        console.error("Failed to fetch players:", error);
        alert("Không thể tải danh sách người chơi.");
    } finally {
        isLoading.value = false;
    }
}

// Xử lý việc submit form (cả Thêm mới và Cập nhật), tương đương handleFormSubmit
async function handleFormSubmit() {
    if (!formState.value.name.trim()) {
        alert("Tên người chơi không được để trống.");
        return;
    }

    try {
        if (isEditMode.value) {
            await api.updatePlayer(editingPlayerId.value, formState.value);
            alert("Cập nhật người chơi thành công!");
        } else {
            await api.addPlayer(formState.value);
            alert("Thêm người chơi mới thành công!");
        }
        resetForm();
        fetchPlayers(); // Tải lại danh sách
    } catch (error) {
        console.error("Error submitting form:", error);
        const errorMsg = error.response?.data?.error || "Đã có lỗi xảy ra. Vui lòng thử lại.";
        alert(errorMsg);
    }
}

// Xóa người chơi
async function handleDeletePlayer(playerId, playerName) {
    if (confirm(`Bạn có chắc chắn muốn xóa người chơi "${playerName}"?`)) {
        try {
            await api.deletePlayer(playerId);
            alert("Xóa người chơi thành công!");
            fetchPlayers(); // Tải lại danh sách
        } catch (error) {
            console.error(`Failed to delete player ${playerId}:`, error);
            alert("Xóa người chơi thất bại.");
        }
    }
}

// Mở modal chi tiết, tương đương hàm renderPlayerDetail
function handleViewDetails(player) {
    selectedPlayer.value = player;
    isModalVisible.value = true;
}

// Chuẩn bị form cho việc chỉnh sửa
function handleEditClick(player) {
    isEditMode.value = true;
    editingPlayerId.value = player.id;
    // Copy chính xác dữ liệu của player vào formState
    // Sử dụng Object.assign để chỉ copy các key có trong formState ban đầu
    const initialFormKeys = Object.keys(formState.value);
    const playerForForm = {};
    initialFormKeys.forEach(key => {
        if (player.hasOwnProperty(key)) {
            playerForForm[key] = player[key];
        }
    });
    formState.value = playerForForm;

    window.scrollTo(0, 0); // Cuộn lên đầu trang để thấy form
}

// Reset form về trạng thái ban đầu, tương đương resetForm
function resetForm() {
    isEditMode.value = false;
    editingPlayerId.value = null;
    formState.value = {
        name: '',
        gender: 'Nam',
        type: 'Vãng lai',
        contact_info: '',
        skill_level: 3.0,
    };
}

// Chạy hàm fetchPlayers khi component được mount (tương đương init())
onMounted(fetchPlayers);
</script>

<template>
    <div class="main-content-wrapper">
        <header class="page-header">
            <h1>Quản lý Người chơi</h1>
            <p>Thêm, sửa, xóa và xem thông tin chi tiết của người chơi.</p>
        </header>

        <div class="player-grid-container">
            <div class="content-box">
                <div class="box-header">
                    <h2>Danh sách người chơi ({{ players.length }})</h2>
                </div>
                <div class="box-content" id="player-list-container">
                    <div v-if="isLoading" class="loading-indicator">Đang tải...</div>
                    <div v-else-if="players.length === 0" class="empty-state">Không có người chơi nào.</div>
                    <div v-else>
                        <div v-for="player in players" :key="player.id" class="player-card">
                            <div class="player-info">
                                <div class="player-avatar">{{ getAvatarInitial(player.name) }}</div>
                                <div class="player-details">
                                    <span class="player-name">{{ player.name }}</span>
                                    <span class="player-meta">Level: {{ player.skill_level }} | {{ player.type }}</span>
                                </div>
                            </div>
                            <div class="player-actions">
                                <button @click="handleViewDetails(player)" class="button button-secondary button-sm">Xem</button>
                                <button @click="handleEditClick(player)" class="button button-edit button-sm">Sửa</button>
                                <button @click="handleDeletePlayer(player.id, player.name)" class="button button-danger button-sm">Xóa</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="content-box sticky-form">
                <div class="box-header">
                    <h2 v-if="isEditMode">Chỉnh sửa thông tin</h2>
                    <h2 v-else>Thêm người chơi mới</h2>
                </div>
                <div class="box-content">
                    <form id="player-form" @submit.prevent="handleFormSubmit" novalidate>
                        <div class="form-group">
                            <label for="name">Tên người chơi *</label>
                            <input type="text" id="name" name="name" v-model="formState.name" required>
                        </div>
                        <div class="form-group">
                            <label for="skill_level">Level kỹ năng</label>
                            <input type="number" id="skill_level" name="skill_level" v-model.number="formState.skill_level" step="0.1" min="1" max="5">
                        </div>
                        
                        <a href="#" id="toggle-advanced-btn" @click.prevent="showAdvanced = !showAdvanced" class="advanced-toggle">
                            <span v-if="showAdvanced">Thu gọn bớt 🔼</span>
                            <span v-else>Thiết lập nâng cao ⚙️</span>
                        </a>

                        <div v-show="showAdvanced" id="advanced-settings-container">
                             <div class="form-group">
                                <label for="gender">Giới tính</label>
                                <select id="gender" name="gender" v-model="formState.gender">
                                    <option>Nam</option>
                                    <option>Nữ</option>
                                    <option>Khác</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="type">Loại hình</label>
                                <select id="type" name="type" v-model="formState.type">
                                    <option>Cố định</option>
                                    <option>Vãng lai</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="contact_info">Thông tin liên hệ</label>
                                <input type="text" id="contact_info" name="contact_info" v-model="formState.contact_info">
                            </div>
                        </div>

                        <div class="form-actions">
                             <button type="submit" class="button button-primary">
                                {{ isEditMode ? 'Lưu thay đổi' : 'Thêm người chơi' }}
                            </button>
                            <button v-if="isEditMode" @click="resetForm" type="button" class="button button-secondary">Hủy</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div v-if="isModalVisible" id="player-detail-modal" class="modal-overlay" @click.self="isModalVisible = false">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Chi tiết người chơi</h2>
                    <span class="close-btn" @click="isModalVisible = false">&times;</span>
                </div>
                <div class="modal-body" v-if="selectedPlayer">
                    <div class="detail-grid">
                        <div class="info-field"><label>Tên</label><span>{{ selectedPlayer.name }}</span></div>
                        <div class="info-field"><label>Ngày tham gia</label><span>{{ formatDate(selectedPlayer.join_date) }}</span></div>
                        <div class="info-field"><label>Loại hình</label><span>{{ selectedPlayer.type }}</span></div>
                        <div class="info-field"><label>Giới tính</label><span>{{ selectedPlayer.gender }}</span></div>
                        <div class="info-field"><label>Số điện thoại</label><span>{{ selectedPlayer.contact_info || 'Chưa có' }}</span></div>
                        <div class="info-field"><label>Trạng thái</label><span>{{ selectedPlayer.is_active ? 'Đang chơi' : 'Đang nghỉ' }}</span></div>
                        <div class="info-field"><label>Level</label><span>{{ selectedPlayer.skill_level.toFixed(1) }}</span></div>
                        <hr style="grid-column: 1 / -1;">
                        <div class="info-field"><label>Tổng số trận</label><span>{{ selectedPlayer.total_matches_played }}</span></div>
                        <div class="info-field"><label>Tổng số trận thắng</label><span>{{ selectedPlayer.total_wins }}</span></div>
                        <div class="info-field"><label>Tỷ lệ thắng</label><span>{{ (selectedPlayer.win_rate * 100).toFixed(1) }}%</span></div>
                        <div class="info-field"><label>Lần chơi cuối</label><span>{{ formatDate(selectedPlayer.last_played_date) }}</span></div>
                        <div class="info-field"><label>Số buổi đã tham gia</label><span>{{ selectedPlayer.total_sessions_attended }}</span></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* CSS được trích xuất từ players.html và style.css, đảm bảo giao diện giống hệt */
.player-grid-container {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.5rem;
}

.sticky-form {
    position: sticky;
    top: 1.5rem;
}

.player-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius);
    margin-bottom: 1rem;
    transition: box-shadow 0.2s;
    background-color: var(--color-surface);
}

.player-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.player-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.player-avatar {
    width: 50px;
    height: 50px;
    background-color: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 1.5rem;
    font-weight: 700;
}

.player-details {
    display: flex;
    flex-direction: column;
}

.player-name {
    font-weight: 600;
    color: var(--color-dark);
}

.player-meta {
    font-size: 0.8rem;
    color: var(--color-secondary);
}

.player-actions {
    display: flex;
    gap: 0.5rem;
}

.advanced-toggle {
    display: block;
    margin: 1rem 0;
    color: var(--color-primary);
    text-decoration: none;
    font-size: 0.9rem;
}

/* CSS cho Modal (giữ nguyên từ file cũ) */
.modal-overlay {
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-content {
    background-color: var(--color-surface);
    border-radius: var(--border-radius);
    width: 90%;
    max-width: 700px;
    box-shadow: var(--box-shadow);
    animation: slide-down 0.3s ease-out;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
    color: var(--color-dark);
}

.close-btn {
    color: var(--color-secondary);
    font-size: 2rem;
    font-weight: bold;
    cursor: pointer;
}

.close-btn:hover {
    color: var(--color-dark);
}

.modal-body {
    padding: 1.5rem;
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
}

.info-field {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    background-color: #f8f9fa;
    border-radius: 4px;
}

.info-field label {
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--color-secondary);
    margin-bottom: 0.25rem;
}

.info-field span {
    color: var(--color-dark);
}

@keyframes slide-down {
    from {
        opacity: 0;
        transform: translateY(-30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>