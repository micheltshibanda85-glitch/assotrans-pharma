(() => {
  "use strict";
  // ================= SÉCURITÉ ET CONNEXION =================
const PASSWORDS = {
  "admin": "pharma2026",
  "superviseur": "super2026"
};

function checkLogin() {
  // Si l'utilisateur est déjà connecté (session active), on affiche le site
  if (sessionStorage.getItem("assotrans_logged") === "true") {
    showApp();
  } else {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("app-content").style.display = "none";
  }
}

function showApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-content").style.display = "block";
  
  // On vérifie le rôle pour adapter l'interface
  const role = sessionStorage.getItem("assotrans_role");
  if (role === "superviseur") {
    // Le superviseur ne peut pas ajouter de médicaments
    const addBtn = document.getElementById("add-btn");
    if (addBtn) addBtn.style.display = "none";
    // Il ne peut pas non plus supprimer (on gère ça dans le tableau)
  }
  
  // Initialiser les données une fois connecté
  loadData();
  renderTable();
  updateKPIs();
  setupEventListeners();
}

// Gestion du formulaire de login
document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;
  const errorMsg = document.getElementById("login-error");

  if (PASSWORDS[user] === pass) {
    // Connexion réussie
    sessionStorage.setItem("assotrans_logged", "true");
    sessionStorage.setItem("assotrans_role", user);
    errorMsg.style.display = "none";
    document.getElementById("login-form").reset();
    showApp();
  } else {
    // Échec
    errorMsg.style.display = "block";
  }
});

// Gestion de la déconnexion
document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("assotrans_logged");
  sessionStorage.removeItem("assotrans_role");
  location.reload(); // Recharge la page pour revenir au login
});
  console.log("[ASSOTRANS] Script chargé");

  // Clé pour le localStorage
  const STORAGE_KEY = "assotrans_inventory";

  // État de l'application
  let inventory = [];
  let editingId = null;

  // Éléments DOM
  const tableBody = document.getElementById("table-body");
  const emptyState = document.getElementById("empty-state");
  const modalOverlay = document.getElementById("modal-overlay");
  const medForm = document.getElementById("med-form");
  const searchInput = document.getElementById("search-input");
  
  // KPIs
  const kpiTotal = document.getElementById("kpi-total");
  const kpiLowStock = document.getElementById("kpi-low-stock");
  const kpiExpiring = document.getElementById("kpi-expiring");

  // ================= INITIALISATION =================
  function init() {
    loadData();
    renderTable();
    updateKPIs();
    setupEventListeners();
  }

  // ================= DONNÉES (LOCALSTORAGE) =================
  function loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        inventory = JSON.parse(stored);
      } else {
        // Données de démonstration au premier lancement
        inventory = [
          { id: 1, name: "Paracétamol 500mg", form: "Comprimé", price: 500, qtyInit: 200, qtyAct: 150, expiry: "2026-12-31" },
          { id: 2, name: "Amoxicilline 500mg", form: "Gélule", price: 1500, qtyInit: 100, qtyAct: 8, expiry: "2025-10-15" },
          { id: 3, name: "Quinine 300mg", form: "Comprimé", price: 800, qtyInit: 300, qtyAct: 120, expiry: "2024-05-20" },
          { id: 4, name: "Sirop Toux Enfant", form: "Sirop", price: 3500, qtyInit: 50, qtyAct: 45, expiry: "2026-01-01" }
        ];
        saveData();
      }
    } catch (e) {
      console.error("Erreur de lecture locale:", e);
      inventory = [];
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
    } catch (e) {
      console.error("Erreur de sauvegarde:", e);
      alert("Erreur de sauvegarde. Le stockage local est peut-être plein.");
    }
  }

  // ================= RENDU =================
  function renderTable(filterText = "") {
  tableBody.innerHTML = "";
  
  const filtered = inventory.filter(item => 
    item.name.toLowerCase().includes(filterText.toLowerCase()) || 
    item.form.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  // On récupère le rôle de l'utilisateur connecté
  const role = sessionStorage.getItem("assotrans_role");

  filtered.forEach((item, index) => {
    const tr = document.createElement("tr");
    
    // Calculs de statut
    const isLowStock = item.qtyAct < 10;
    const isOutOfStock = item.qtyAct === 0;
    
    // Calcul de la date de péremption
    const today = new Date();
    const expDate = new Date(item.expiry);
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let expiryBadge = `<span class="badge badge-ok">OK</span>`;
    let expiryText = formatDate(item.expiry);
    if (diffDays < 0) {
      expiryBadge = `<span class="badge badge-expire">Périmé</span>`;
    } else if (diffDays < 180) {
      expiryBadge = `<span class="badge badge-warning">Bientôt</span>`;
    }

    let stockBadge = `<span class="badge badge-ok">${item.qtyAct}</span>`;
    if (isOutOfStock) stockBadge = `<span class="badge badge-out">Rupture</span>`;
    else if (isLowStock) stockBadge = `<span class="badge badge-low">${item.qtyAct}</span>`;

    // GESTION DES BOUTONS SELON LE RÔLE (Admin vs Superviseur)
    let actionsHTML = "";
    if (role === "admin") {
      actionsHTML = `
        <button class="action-btn" onclick="editItem(${item.id})" title="Modifier">✏️</button>
        <button class="action-btn" onclick="deleteItem(${item.id})" title="Supprimer">🗑️</button>
      `;
    } else {
      // Le superviseur peut modifier, mais pas supprimer
      actionsHTML = `
        <button class="action-btn" onclick="editItem(${item.id})" title="Ajuster le stock">✏️</button>
      `;
    }

    // Injection du HTML dans la ligne
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.form}</td>
      <td>${item.price.toLocaleString('fr-FR')} FC</td>
      <td>${item.qtyInit}</td>
      <td>${stockBadge}</td>
      <td>${expiryText} ${expiryBadge}</td>
      <td>${actionsHTML}</td>
    `;
    tableBody.appendChild(tr);
  });
}
  // ================= KPIs =================
  function updateKPIs() {
    const total = inventory.length;
    const lowStock = inventory.filter(i => i.qtyAct < 10).length;
    
    const today = new Date();
    const expiringSoon = inventory.filter(i => {
      const exp = new Date(i.expiry);
      const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff < 180;
    }).length;

    kpiTotal.textContent = total;
    kpiLowStock.textContent = lowStock;
    kpiExpiring.textContent = expiringSoon;
  }

  // ================= MODAL & FORMULAIRE =================
  function openModal(item = null) {
    modalOverlay.classList.add("active");
    if (item) {
      document.getElementById("modal-title").textContent = "Modifier le médicament";
      document.getElementById("med-id").value = item.id;
      document.getElementById("med-name").value = item.name;
      document.getElementById("med-form").value = item.form;
      document.getElementById("med-price").value = item.price;
      document.getElementById("med-qty-init").value = item.qtyInit;
      document.getElementById("med-qty-act").value = item.qtyAct;
      document.getElementById("med-expiry").value = item.expiry;
      editingId = item.id;
    } else {
      document.getElementById("modal-title").textContent = "Ajouter un médicament";
      medForm.reset();
      document.getElementById("med-id").value = "";
      editingId = null;
    }
  }

  function closeModal() {
    modalOverlay.classList.remove("active");
    medForm.reset();
    editingId = null;
  }

  // ================= ÉVÉNEMENTS =================
  function setupEventListeners() {
    // Ouvrir modal
    document.getElementById("add-btn").addEventListener("click", () => openModal());
    document.getElementById("close-modal").addEventListener("click", closeModal);
    document.getElementById("cancel-btn").addEventListener("click", closeModal);
    
    // Fermer en cliquant dehors
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    // Soumission du formulaire
    medForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const newItem = {
        id: editingId || Date.now(), // Génère un ID unique basé sur le temps
        name: document.getElementById("med-name").value.trim(),
        form: document.getElementById("med-form").value,
        price: parseInt(document.getElementById("med-price").value),
        qtyInit: parseInt(document.getElementById("med-qty-init").value),
        qtyAct: parseInt(document.getElementById("med-qty-act").value),
        expiry: document.getElementById("med-expiry").value
      };

      if (editingId) {
        // Modification
        const index = inventory.findIndex(i => i.id === editingId);
        if (index !== -1) inventory[index] = newItem;
      } else {
        // Ajout
        inventory.push(newItem);
      }

      saveData();
      renderTable(searchInput.value);
      updateKPIs();
      closeModal();
    });

    // Recherche
    searchInput.addEventListener("input", (e) => {
      renderTable(e.target.value);
    });

    // Export CSV
    document.getElementById("export-btn").addEventListener("click", exportCSV);
  }

  // ================= ACTIONS GLOBALES (appelées depuis le HTML) =================
  window.editItem = function(id) {
    const item = inventory.find(i => i.id === id);
    if (item) openModal(item);
  };

  window.deleteItem = function(id) {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce médicament de l'inventaire ?")) {
      inventory = inventory.filter(i => i.id !== id);
      saveData();
      renderTable(searchInput.value);
      updateKPIs();
    }
  };

  // ================= EXPORT CSV =================
  function exportCSV() {
    if (inventory.length === 0) {
      alert("L'inventaire est vide.");
      return;
    }

    // En-têtes
    const headers = ["N°", "Libellé (DCI)", "Forme galénique", "Prix unitaire (FC)", "Qté initiale", "Qté actuelle", "Date de péremption"];
    
    // Lignes
    const rows = inventory.map((item, index) => [
      index + 1,
      `"${item.name}"`, // Entre guillemets pour gérer les virgules dans les noms
      item.form,
      item.price,
      item.qtyInit,
      item.qtyAct,
      formatDate(item.expiry)
    ]);

    // Assemblage
    const csvContent = [
      headers.join(";"),
      ...rows.map(r => r.join(";"))
    ].join("\n");

    // Téléchargement
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // \uFEFF pour qu'Excel gère les accents
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventaire_Assotrans_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ================= UTILS =================
  function formatDate(dateString) {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  // DÉMARRAGE
  checkLogin();

})();