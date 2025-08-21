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
    let existingRecords = [];
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
        const lines = csvText.trim().split(/\r\n|\n/);
        for (let i = 1; i < lines.length; i++) {
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

    function readNFC() { /* ... 與前一版相同 ... */ }
    function getGPSPosition() { /* ... 與前一版相同 ... */ }

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
            //alert('請先完成「一鍵讀取」步驟！');
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
        csvContent += allRecords.map(row => 
            row.map(field => (field || '').toString().replace(/,/g, '，').replace(/\r\n|\n/g, ' ')).join(',')
        ).join('\n');
        
        // **改善：確保 BOM 存在，以最大化相容性**
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        downloadBlob(blob, getFileName() + '.csv');

        // **改善：提供更明確的下載後指引**
        elements.downloadStatus.textContent = `檔案 "${getFileName()}.csv" 已下載至您的「下載」資料夾。\n請使用 Google Sheets 或 Excel App 開啟檢視。`;
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
