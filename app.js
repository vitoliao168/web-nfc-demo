document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素宣告 ---
    const elements = {
        timestamp: document.getElementById('timestamp'), nfcSerial: document.getElementById('nfcSerial'), gpsLocation: document.getElementById('gpsLocation'),
        unitName: document.getElementById('unitName'), equipmentName: document.getElementById('equipmentName'), roadLocation: document.getElementById('roadLocation'),
        description: document.getElementById('description'), remarks: document.getElementById('remarks'),
        startScanBtn: document.getElementById('startScanBtn'), scanStatus: document.getElementById('scanStatus'),
        downloadCsvBtn: document.getElementById('downloadCsvBtn'),
        downloadStatus: document.getElementById('downloadStatus'),
        csvUploader: document.getElementById('csvUploader'), uploadArea: document.getElementById('uploadArea'),
        uploadStatus: document.getElementById('uploadStatus'), recordsPreview: document.getElementById('recordsPreview'),
    };

    // --- 全域變數 ---
    let existingRecords = []; // 儲存已載入的紀錄陣列
    const CSV_HEADER = ["卡片序號", "日期時間", "GPS位置", "單位", "設備名稱", "位置(道路)說明", "功能簡介", "備註"];

    // --- 檔案讀取功能 ---
    elements.csvUploader.addEventListener('change', handleFileSelect);
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { elements.uploadArea.addEventListener(eventName, preventDefaults, false); });
    elements.uploadArea.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    function handleDrop(e) { handleFileSelect({ target: e.dataTransfer }); }
    
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                parseCsvContent(content);
                elements.uploadStatus.textContent = `✅ 已成功載入 "${file.name}" 的 ${existingRecords.length} 筆紀錄。`;
            };
            reader.readAsText(file, "UTF-8");
        } else {
             elements.uploadStatus.textContent = "❌ 請選擇一個 .csv 檔案。";
        }
        elements.csvUploader.value = '';
    }
    
    function parseCsvContent(csvText) {
        existingRecords = [];
        const lines = csvText.trim().split(/\r\n|\n/); // 處理不同作業系統的換行符
        for (let i = 1; i < lines.length; i++) { // 從第二行開始讀取，跳過標頭
            if (lines[i].trim()) {
                existingRecords.push(lines[i].trim().split(',')); 
            }
        }
        updatePreview();
    }
    function updatePreview() {
        elements.recordsPreview.value = CSV_HEADER.join(',') + '\n' + existingRecords.map(row => row.join(',')).join('\n');
    }

    // --- "一鍵讀取" 功能 ---
    elements.startScanBtn.addEventListener('click', async () => {
        elements.scanStatus.textContent = "正在處理...";
        updateTimestamp();
        try {
            const [nfcResult, gpsResult] = await Promise.all([readNFC(), getGPSPosition()]);
            elements.nfcSerial.value = nfcResult.serialNumber;
            elements.gpsLocation.value = `${gpsResult.latitude.toFixed(6)}, ${gpsResult.longitude.toFixed(6)}`;
            elements.scanStatus.textContent = "✅ NFC 和 GPS 皆讀取成功！";
        } catch (error) {
            elements.scanStatus.textContent = `❌ 操作失敗: ${error.message}`;
        }
    });

    function readNFC() { return new Promise(async (resolve, reject) => { if (!('NDEFReader' in window)) { return reject(new Error('此瀏覽器不支援 Web NFC')); } try { const ndef = new NDEFReader(); await ndef.scan(); elements.scanStatus.textContent = "請將 NFC 標籤靠近手機背面..."; ndef.addEventListener('reading', ({ serialNumber }) => resolve({ serialNumber }), { once: true }); } catch (error) { reject(error); } }); }
    function getGPSPosition() { return new Promise((resolve, reject) => { if (!navigator.geolocation) { return reject(new Error('您的瀏覽器不支援地理定位功能')); } navigator.geolocation.getCurrentPosition( (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), (error) => { let message = '無法取得 GPS 位置'; if (error.code === error.PERMISSION_DENIED) message = '您已拒絕 GPS 權限'; reject(new Error(message)); } ); }); }

    // --- 時間與資料處理 ---
    function updateTimestamp() { elements.timestamp.value = formatROCTime(new Date()); }
    function formatROCTime(date) {
        const rocYear = date.getFullYear() - 1911;
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        const hours = ('0' + date.getHours()).slice(-2);
        const minutes = ('0' + date.getMinutes()).slice(-2);
        return `${rocYear}/${month}/${day} ${hours}:${minutes}`;
    }
    setInterval(updateTimestamp, 1000);
    updateTimestamp();

    function collectDataAsArray() {
        const data = [
            elements.nfcSerial.value, elements.timestamp.value, elements.gpsLocation.value, elements.unitName.value,
            elements.equipmentName.value, elements.roadLocation.value, elements.description.value, elements.remarks.value
        ];
        if (!data[0] || !data[2] || data[0].includes('讀取') || data[2].includes('讀取')) {
            alert('請先完成「一鍵讀取」步驟！ 或是繼續儲存空白資料');
            //return null;
        }
        return data;
    }
    
    // --- 檔案下載 ---
    function getFileName() { const today = new Date(); const month = ('0' + (today.getMonth() + 1)).slice(-2); const day = ('0' + today.getDate()).slice(-2); return `${month}${day}`; }

    elements.downloadCsvBtn.addEventListener('click', () => {
        const newRecord = collectDataAsArray();
        if (!newRecord) return;

        const allRecords = [...existingRecords, newRecord];
        let csvContent = CSV_HEADER.join(',') + '\n';
        
        // **核心修改：移除引號，並將欄位內的逗號替換為全形逗號，換行符替換為空格**
        csvContent += allRecords.map(row => 
            row.map(field => (field || '').toString().replace(/,/g, '，').replace(/\r\n|\n/g, ' ')).join(',')
        ).join('\n');
        
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, getFileName() + '.csv');
        elements.downloadStatus.textContent = `CSV 檔案 "${getFileName()}.csv" 已新增紀錄並下載。`;
    });

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
});
