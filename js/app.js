const AIRTABLE_API_KEY = 'patG7MV5FXpkeFWqS.1fd2aea9e52ee4537eb78f5cc668a4785bd6d2d5118f2a40a8a03d522f72790c'; // Substitua pela sua API Key
const BASE_ID = 'appkIkoO2SW02yNIW'; // Substitua pelo ID da sua base
const TABLE_NAME = 'Table1'; // Nome da tabela no Airtable
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

const headers = {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
};

const html5QrcodeScanner = new Html5Qrcode("reader");

// Variável global para armazenar o local de leitura
let localDeLeitura = "";

// Preenche a caixa de seleção com os setores disponíveis no Airtable
async function populateSectorDropdown() {
    const dropdown = document.getElementById('sectorDropdown');
    dropdown.innerHTML = '<option value="">Selecione o local de leitura</option>';

    try {
        const response = await axios.get(AIRTABLE_URL, { headers });

        const setores = new Set();
        response.data.records.forEach(record => {
            if (record.fields.Setor) {
                setores.add(record.fields.Setor);
            }
        });

        setores.forEach(setor => {
            const option = document.createElement('option');
            option.value = setor;
            option.textContent = setor;
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao buscar setores no Airtable:", error);
    }
}

// Atualiza a variável `localDeLeitura` quando um setor é selecionado
document.getElementById('sectorDropdown').addEventListener('change', (e) => {
    localDeLeitura = e.target.value;
    console.log(`Local de leitura selecionado: ${localDeLeitura}`);
});

function displaySector(sector) {
    const sectorInfo = document.getElementById('sectorInfo');
    const sectorName = document.getElementById('sectorName');

    sectorName.textContent = sector;
    sectorInfo.style.display = 'block';
}

function startScanning() {
    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "environment" // Câmera traseira
            //focusMode: "continuous"    // Tenta focar continuamente
        }
    })
        .then(() => {
            html5QrcodeScanner.start(
                { facingMode: "environment" },
                {
                    fps: 5,
                    qrbox: { width: 300, height: 300 }
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
    const filter = `filterByFormula=SEARCH("${code}", {Patrimônio})`;
    console.log("Consultando Airtable com o código:", code);

    try {
        const response = await axios.get(`${AIRTABLE_URL}?${filter}`, { headers });

        if (response.data.records.length > 0) {
            const record = response.data.records[0];
            console.log("Produto encontrado:", record.fields);

            return {
                recordId: record.id,
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

async function updateStatusInAirtable(recordId, status) {
    const url = `${AIRTABLE_URL}/${recordId}`;
    const data = {
        fields: {
            status: status,
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
        navigator.vibrate([200, 100, 200]);
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

        if (product.setor === localDeLeitura) {
            await updateStatusInAirtable(product.recordId, "ok");
        } else {
            await updateStatusInAirtable(
                product.recordId,
                `ok, equipamento estava no ${localDeLeitura}`
            );
        }

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

// Inicializa o dropdown com os setores disponíveis
populateSectorDropdown();
