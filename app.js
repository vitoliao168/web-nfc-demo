document.addEventListener('DOMContentLoaded', () => {
    // --- 函式庫宣告 ---
    const { jsPDF } = window.jspdf;

    // --- DOM 元素宣告 ---
    const elements = {
        // ... 所有表單欄位 ...
        timestamp: document.getElementById('timestamp'), nfcSerial: document.getElementById('nfcSerial'), gpsLocation: document.getElementById('gpsLocation'),
        unitName: document.getElementById('unitName'), equipmentName: document.getElementById('equipmentName'), roadLocation: document.getElementById('roadLocation'),
        description: document.getElementById('description'), remarks: document.getElementById('remarks'),
        // ... 按鈕和狀態 ...
        startScanBtn: document.getElementById('startScanBtn'), scanStatus: document.getElementById('scanStatus'),
        downloadCsvBtn: document.getElementById('downloadCsvBtn'), downloadPdfBtn: document.getElementById('downloadPdfBtn'),
        downloadStatus: document.getElementById('downloadStatus'),
        // ... 檔案上傳相關 ...
        csvUploader: document.getElementById('csvUploader'), uploadArea: document.getElementById('uploadArea'),
        uploadStatus: document.getElementById('uploadStatus'), recordsPreview: document.getElementById('recordsPreview'),
    };

    // --- 全域變數 ---
    let existingRecords = []; // 儲存已載入的紀錄陣列
    const CSV_HEADER = ["卡片序號", "日期時間", "GPS位置", "單位", "設備名稱", "位置(道路)說明", "功能簡介", "備註"];

    // --- 檔案讀取功能 ---
    elements.uploadArea.addEventListener('click', () => elements.csvUploader.click());
    elements.csvUploader.addEventListener('change', handleFileSelect);
    
    // 支援拖曳上傳
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.uploadArea.addEventListener(eventName, preventDefaults, false);
    });
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
    }
    
    function parseCsvContent(csvText) {
        existingRecords = []; // 清空舊紀錄
        const lines = csvText.trim().split('\n');
        // 從第二行開始讀取，跳過標頭
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                // 簡易的 CSV 解析，需注意如果欄位內有逗號會出錯，但此處夠用
                existingRecords.push(lines[i].trim().split(',')); 
            }
        }
        updatePreview();
    }

    function updatePreview() {
        elements.recordsPreview.value = CSV_HEADER.join(',') + '\n' + existingRecords.map(row => row.join(',')).join('\n');
    }

    // --- "一鍵讀取" 功能 (封裝成 Promise 以便管理) ---
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

    function readNFC() { /* ... 與前一版相同 ... */ return new Promise(async (resolve, reject) => { if (!('NDEFReader' in window)) { return reject(new Error('此瀏覽器不支援 Web NFC')); } try { const ndef = new NDEFReader(); await ndef.scan(); elements.scanStatus.textContent = "請將 NFC 標籤靠近手機背面..."; ndef.addEventListener('reading', ({ serialNumber }) => resolve({ serialNumber }), { once: true }); } catch (error) { reject(error); } }); }
    function getGPSPosition() { /* ... 與前一版相同 ... */ return new Promise((resolve, reject) => { if (!navigator.geolocation) { return reject(new Error('您的瀏覽器不支援地理定位功能')); } navigator.geolocation.getCurrentPosition( (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), (error) => { let message = '無法取得 GPS 位置'; if (error.code === error.PERMISSION_DENIED) message = '您已拒絕 GPS 權限'; reject(new Error(message)); } ); }); }

    // --- 時間戳記 ---
    function updateTimestamp() { const now = new Date(); const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }; elements.timestamp.value = now.toLocaleString('zh-TW', options).replace(/\//g, '-'); }
    setInterval(updateTimestamp, 1000); updateTimestamp();

    // --- 核心功能：下載檔案 ---
    function getFileName() { const today = new Date(); const month = ('0' + (today.getMonth() + 1)).slice(-2); const day = ('0' + today.getDate()).slice(-2); return `${month}${day}`; }

    elements.downloadCsvBtn.addEventListener('click', () => {
        const newRecord = collectDataAsArray();
        if (!newRecord) return;

        const allRecords = [...existingRecords, newRecord];
        let csvContent = CSV_HEADER.join(',') + '\n';
        csvContent += allRecords.map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(',')).join('\n');
        
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, getFileName() + '.csv');
        elements.downloadStatus.textContent = `CSV 檔案已下載。`;
    });

    elements.downloadPdfBtn.addEventListener('click', async () => {
        const newRecord = collectDataAsArray();
        if (!newRecord) return;

        elements.downloadStatus.textContent = '正在產生 PDF，請稍候...';
        const allRecords = [...existingRecords, newRecord];

        const doc = new jsPDF({ orientation: 'landscape' });
        try {
            const response = await fetch('./NotoSansTC-Regular.ttf');
            if (!response.ok) throw new Error('字體檔案載入失敗！');
            const fontBlob = await response.blob();
            const reader = new FileReader();
            reader.onload = function (e) {
                const fontData = e.target.result.split(',')[1];
                doc.addFileToVFS('NotoSansTC.ttf', fontData);
                doc.addFont('NotoSansTC.ttf', 'NotoSansTC', 'normal');
                doc.setFont('NotoSansTC');
                doc.text("交通設備盤點總紀錄", 14, 15);
                
                doc.autoTable({
                    head: [CSV_HEADER], body: allRecords, startY: 20,
                    styles: { font: 'NotoSansTC', fontSize: 8 },
                    headStyles: { fillColor: [0, 123, 255], textColor: 255 },
                    alternateRowStyles: { fillColor: [240, 242, 245] }
                });

                doc.save(getFileName() + '.pdf');
                elements.downloadStatus.textContent = `PDF 檔案已下載。`;
            };
            reader.readAsDataURL(fontBlob);
        } catch (error) {
            alert(`產生 PDF 失敗: ${error.message}`);
            elements.downloadStatus.textContent = 'PDF 產生失敗。';
        }
    });
    
    // 輔助函數
    function collectDataAsArray() {
        const data = [
            elements.nfcSerial.value, elements.timestamp.value, elements.gpsLocation.value, elements.unitName.value,
            elements.equipmentName.value, elements.roadLocation.value, elements.description.value, elements.remarks.value
        ];
        if (!data[0] || !data[2] || data[0].includes('讀取') || data[2].includes('讀取')) {
            alert('請先完成自動讀取！');
            return null;
        }
        return data;
    }
    
    function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); }
});