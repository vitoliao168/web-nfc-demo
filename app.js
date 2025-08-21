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
                elements.uploadStatus.textContent = `✅ 已成功載入 "${file.name}" 的 ${existingRecords.length} 筆紀錄。`;
            };
            reader.readAsText(file, "UTF-8");
        } else {
             elements.uploadStatus.textContent = "❌ 請選擇一個 .csv 檔案。";
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
                if (inQuotes && line[i+1] === '"') {
                    currentField += '"';
                    i++;
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
        result.push(currentField);
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

    // --- 時間與資料處理 ---
    function updateTimestamp() { elements.timestamp.value = formatROCTime(new Date()); }
    function formatROCTime(date) { /* ... 與前一版相同 ... */ }
    setInterval(updateTimestamp, 1000);
    updateTimestamp();

    function collectDataAsArray() { /* ... 與前一版相同 ... */ }
    
    // --- 檔案下載 ---
    function getFileName() { /* ... 與前一版相同 ... */ }

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
                if (safeField.includes(',') || safeField.includes('"') || safeField.includes('\n')) {
                    return `"${safeField.replace(/"/g, '""')}"`;
                }
                return safeField;
            }).join(',')
        ).join('\n');
        
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, getFileName() + '.csv');
        elements.downloadStatus.textContent = `CSV 檔案 "${getFileName()}.csv" 已新增紀錄並下載。`;
    });

    function downloadBlob(blob, filename) { /* ... 與前一版相同 ... */ }
    
    // 輔助函數
    function readNFC() { /* ... 與前一版相同 ... */ }
    function getGPSPosition() { /* ... 與前一版相同 ... */ }
    
    // --- 應用程式啟動點 ---
    updatePreview();
});
