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
        uploadStatus: document.getElementById('uploadStatus'),
        recordsPreviewContainer: document.getElementById('recordsPreviewContainer'),
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
                elements.uploadStatus.innerHTML = `✅ <strong>已成功載入 "${file.name}" 的 ${existingRecords.length} 筆紀錄。</strong>`;
            };
            reader.readAsText(file, "UTF-8");
        } else {
             elements.uploadStatus.innerHTML = "❌ <strong>請選擇一個 .csv 檔案。</strong>";
        }
        elements.csvUploader.value = '';
    }
    
    // **改善：使用更強健的 CSV 解析器**
    function parseCsvContent(csvText) {
        existingRecords = [];
        const lines = csvText.trim().split(/\r\n|\n/);
        for (let i = 1; i < lines.length; i++) { // 從第二行開始讀取
            if (lines[i].trim()) {
                const parsedRow = parseCsvLine(lines[i]);
                existingRecords.push(parsedRow); 
            }
        }
        updatePreview();
    }
    
    function parseCsvLine(line) {
        const result = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                // 如果是連續兩個引號，視為一個引號字元
                if (inQuotes && line[i+1] === '"') {
                    currentField += '"';
                    i++; // 跳過下一個引號
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        result.push(currentField); // 加入最後一個欄位
        return result;
    }

    function updatePreview() {
        elements.recordsPreviewContainer.innerHTML = '';
        if (existingRecords.length === 0) {
            elements.recordsPreviewContainer.innerHTML = '<p style="text-align:center; color:#888; padding: 1rem;">尚無紀錄</p>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'preview-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        CSV_HEADER.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        existingRecords.forEach(rowData => {
            const row = document.createElement('tr');
            rowData.forEach(cellData => {
                const td = document.createElement('td');
                td.textContent = cellData;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        elements.recordsPreviewContainer.appendChild(table);
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
        
        existingRecords.push(newRecord);
        updatePreview();

        let csvContent = CSV_HEADER.join(',') + '\n';
        
        // **改善：產生符合標準的 CSV 行**
        csvContent += existingRecords.map(row => 
            row.map(field => {
                const safeField = (field || '').toString();
                // 如果欄位包含逗號、引號或換行符，就用引號把它包起來
                if (safeField.includes(',') || safeField.includes('"') || safeField.includes('\n')) {
                    // 將欄位內的引號替換為兩個引號
                    return `"${safeField.replace(/"/g, '""')}"`;
                }
                return safeField;
            }).join(',')
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
    
    // --- 應用程式啟動點 ---
    updatePreview();
});
