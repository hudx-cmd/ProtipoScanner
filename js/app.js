const AIRTABLE_API_KEY = 'patG7MV5FXpkeFWqS.1fd2aea9e52ee4537eb78f5cc668a4785bd6d2d5118f2a40a8a03d522f72790c'; // Substitua pela sua API Key
const BASE_ID = 'appkIkoO2SW02yNIW'; // Substitua pelo ID da sua base
const TABLE_NAME = 'Table1'; // Nome da tabela no Airtable
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

const headers = {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
};

const html5QrcodeScanner = new Html5Qrcode("reader");

function displaySector(sector) {
    const sectorInfo = document.getElementById('sectorInfo');
    const sectorName = document.getElementById('sectorName');

    sectorName.textContent = sector;
    sectorInfo.style.display = 'block';
}

function startScanning() {
    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "environment", // Câmera traseira
            focusMode: "continuous"    // Tenta focar continuamente
        }
    })
        .then(() => {
            html5QrcodeScanner.start(
                { facingMode: "environment" },
                {
                    fps: 20,
                    qrbox: { width: 200, height: 200 }
                },
                onScanSuccess,
                onScanError
            );
        })
        .catch((err) => {
            console.error("Erro ao acessar a câmera:", err);
            alert("Por favor, permita o acesso à câmera para usar o scanner.");
        });
}

function stopScanning() {
    html5QrcodeScanner.stop()
        .then(() => console.log("Scanner parado"))
        .catch((err) => console.error("Erro ao parar scanner:", err));
}

async function fetchProductFromAirtable(code) {
    const filter = `filterByFormula=SEARCH("${code}", {Patrimônio})`; // Busca pelo código de barras no campo 'Patrimônio'
    console.log("Consultando Airtable com o código:", code);

    try {
        const response = await axios.get(`${AIRTABLE_URL}?${filter}`, { headers });

        if (response.data.records.length > 0) {
            const record = response.data.records[0];
            console.log("Produto encontrado:", record.fields);

            return {
                recordId: record.id,          // ID do registro para atualizar o status
                patrimonio: record.fields.Patrimônio,
                setor: record.fields.Setor,
                descricao: record.fields.Descrição,
            };
        } else {
            console.log("Produto não encontrado no Airtable.");
            return null;
        }
    } catch (error) {
        console.error("Erro ao buscar produto no Airtable:", error);
        return null;
    }
}

async function updateStatusInAirtable(recordId) {
    const url = `${AIRTABLE_URL}/${recordId}`; // Endpoint do registro específico
    const data = {
        fields: {
            Status: "ok", // Atualiza o campo 'status' para 'ok'
        },
    };

    try {
        const response = await axios.patch(url, data, { headers });
        console.log("Status atualizado com sucesso:", response.data);
    } catch (error) {
        console.error("Erro ao atualizar o status no Airtable:", error);
    }
}

async function onScanSuccess(decodedText) {
    console.log(`Código detectado: ${decodedText}`);

    const resultContainer = document.getElementById('result');
    const resultText = document.getElementById('result-text');
    const validationMessage = document.getElementById('validation-message');

    resultContainer.style.display = 'block';
    resultText.textContent = decodedText;

    // Realiza três vibrações
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]); // Vibrações: [duração, pausa, duração]
    }

    // Consulta o produto no Airtable
    const product = await fetchProductFromAirtable(decodedText);

    if (product) {
        resultContainer.classList.remove('result-error');
        resultContainer.classList.add('result-success');
        validationMessage.innerHTML = `
            ✅ Produto encontrado!<br>
            <strong>Patrimônio:</strong> ${product.patrimonio}<br>
            <strong>Setor:</strong> ${product.setor}<br>
            <strong>Descrição:</strong> ${product.descricao}
        `;

        // Atualiza o campo 'status' no Airtable
        await updateStatusInAirtable(product.recordId);

        // Exibe o setor destacado
        displaySector(product.setor);
    } else {
        resultContainer.classList.remove('result-success');
        resultContainer.classList.add('result-error');
        validationMessage.innerHTML = '❌ Produto não encontrado!';
    }

    addToHistory(decodedText);
}

function onScanError(error) {
    console.warn(`Erro durante a leitura: ${error}`);
}

function addToHistory(scannedText) {
    const historyList = document.getElementById('history-list');
    const timeString = new Date().toLocaleTimeString();

    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <span>${scannedText}</span>
        <span class="time-stamp">${timeString}</span>
    `;

    historyList.insertBefore(historyItem, historyList.firstChild);
}

document.getElementById('startButton').addEventListener('click', function () {
    const isScanning = this.textContent === "Parar Scanner";

    if (isScanning) {
        stopScanning();
        this.textContent = "Iniciar Scanner";
    } else {
        startScanning();
        this.textContent = "Parar Scanner";
    }
});
