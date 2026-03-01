// Global state
let playersData = [];
let charts = {};
let currentPlayerGamesCache = [];

// DOM Elements
const elements = {
    playerSearch: document.getElementById('playerSearch'),
    playerSelect: document.getElementById('playerSelect'),
    searchResults: document.getElementById('searchResults'),
    seasonSelect: document.getElementById('seasonSelect'),
    opponentSelect: document.getElementById('opponentSelect'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    loadBtn: document.getElementById('loadStatsBtn'),

    dashContent: document.getElementById('dashboardContent'),
    welcomeState: document.getElementById('welcomeState'),

    // Header
    playerName: document.getElementById('playerNameDisplay'),
    playerTeam: document.getElementById('playerTeamDisplay'),
    playerPos: document.getElementById('playerPositionDisplay'),

    // Averages
    avgPts: document.getElementById('avgPts'),
    avgReb: document.getElementById('avgReb'),
    avgAst: document.getElementById('avgAst'),

    // Highlights
    bestGamePts: document.getElementById('bestGamePts'),
    bestGameContext: document.getElementById('bestGameContext'),
    efficiencyRating: document.getElementById('efficiencyRating'),
    gamesPlayed: document.getElementById('gamesPlayedCount'),

    // Table
    tableBody: document.getElementById('gameLogBody'),
    noDataMsg: document.getElementById('noDataMessage'),
    exportBtn: document.getElementById('exportBtn')
};

// Chart.js Default Configs for Dark Theme
Chart.defaults.color = '#8b9bb4';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.font.family = "'Space Grotesk', sans-serif";

document.addEventListener('DOMContentLoaded', () => {
    fetchPlayers();
    setupEventListeners();
});

async function fetchPlayers() {
    try {
        const response = await fetch('/api/players');
        const data = await response.json();
        playersData = data.players;
        populatePlayerDropdown();
    } catch (error) {
        console.error('Error fetching players:', error);
    }
}

function setupEventListeners() {
    elements.playerSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        elements.searchResults.innerHTML = '';
        if (query.length < 2) {
            elements.searchResults.classList.add('d-none');
            return;
        }

        const matches = playersData.filter(p => p.name.toLowerCase().includes(query)).slice(0, 10);

        if (matches.length > 0) {
            elements.searchResults.classList.remove('d-none');
            matches.forEach(player => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action bg-dark text-light border-secondary';
                li.style.cursor = 'pointer';
                li.textContent = player.name;
                li.addEventListener('click', () => {
                    elements.playerSearch.value = player.name;
                    elements.playerSelect.value = player.id;
                    elements.searchResults.classList.add('d-none');
                    elements.loadBtn.disabled = false;
                });
                elements.searchResults.appendChild(li);
            });
        } else {
            elements.searchResults.classList.add('d-none');
        }
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!elements.playerSearch.contains(e.target) && !elements.searchResults.contains(e.target)) {
            elements.searchResults.classList.add('d-none');
        }
    });

    elements.playerSearch.addEventListener('change', () => {
        if (elements.playerSearch.value === '') {
            elements.playerSelect.value = '';
            elements.loadBtn.disabled = true;
        }
    });

    elements.loadBtn.addEventListener('click', async () => {
        const playerId = elements.playerSelect.value;
        if (!playerId) return;

        // Add loading state
        const originalText = elements.loadBtn.innerHTML;
        elements.loadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Fetching Live...';
        elements.loadBtn.disabled = true;

        try {
            await analyzePlayerLogs(playerId);
            // Switch views
            elements.welcomeState.classList.add('d-none');
            elements.dashContent.classList.remove('d-none');
        } catch (err) {
            console.error(err);
            alert("Error loading player data. It may still be downloading from stats.nba.com, please try again.");
        } finally {
            elements.loadBtn.innerHTML = originalText;
            elements.loadBtn.disabled = false;
        }
    });

    elements.exportBtn.addEventListener('click', exportToCSV);

    // Add event listeners to filters to re-process the graphs without re-fetching
    elements.seasonSelect.addEventListener('change', () => filterAndRenderCurrentlyLoadedGames());
    elements.opponentSelect.addEventListener('change', () => filterAndRenderCurrentlyLoadedGames());
    elements.dateFrom.addEventListener('change', () => filterAndRenderCurrentlyLoadedGames());
    elements.dateTo.addEventListener('change', () => filterAndRenderCurrentlyLoadedGames());
}

function populatePlayerDropdown() {
    elements.playerSearch.placeholder = "Search for a player (4000+)";
}

async function analyzePlayerLogs(playerId) {
    const player = playersData.find(p => p.id == playerId);
    if (!player) return;

    try {
        const response = await fetch(`/api/player/games/${playerId}`);
        const data = await response.json();

        currentPlayerGamesCache = data.games || [];

        // Populate Team/Position from response or use fallbacks
        elements.playerName.textContent = player.name;
        elements.playerTeam.textContent = data.team || "NBA Team";
        elements.playerPos.textContent = data.position || "Player";

        if (currentPlayerGamesCache.length === 0) {
            showNoDataState();
            return;
        }

        hideNoDataState();

        // Re-populate filters based on new cache
        populateFiltersFromCache();

        // Render current view
        filterAndRenderCurrentlyLoadedGames();

    } catch (err) {
        console.error("Failed to fetch game logs:", err);
        showNoDataState();
    }
}

function filterAndRenderCurrentlyLoadedGames() {
    if (currentPlayerGamesCache.length === 0) return;

    // 1. Filter Games
    const filteredGames = filterGames(currentPlayerGamesCache);

    if (filteredGames.length === 0) {
        showNoDataState();
        // keep header intact so they know who they are looking at
        return;
    }

    hideNoDataState();

    // 2. Calculate Stats
    calculateAndRenderStats(filteredGames);

    // 3. Render Table
    renderTable(filteredGames);

    // 4. Render Charts
    renderCharts(filteredGames);
}

function populateFiltersFromCache() {
    const seasons = new Set();
    const opponents = new Set();

    currentPlayerGamesCache.forEach(game => {
        if (game.season) seasons.add(game.season);
        if (game.opponent) opponents.add(game.opponent);
    });

    // Reset and populate Season
    elements.seasonSelect.innerHTML = '<option value="All">All Seasons</option>';
    Array.from(seasons).sort().reverse().forEach(s => {
        elements.seasonSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    // Reset and populate Opponent
    elements.opponentSelect.innerHTML = '<option value="All">All Teams</option>';
    Array.from(opponents).sort().forEach(opp => {
        elements.opponentSelect.innerHTML += `<option value="${opp}">${opp}</option>`;
    });

    // Reset Dates
    elements.dateFrom.value = '';
    elements.dateTo.value = '';
}

function filterGames(games) {
    const selectedSeason = elements.seasonSelect.value;
    const selectedOpponent = elements.opponentSelect.value;
    const dateFrom = elements.dateFrom.value;
    const dateTo = elements.dateTo.value;

    return games.filter(game => {
        let matches = true;
        if (selectedSeason !== "All" && game.season !== selectedSeason) matches = false;
        if (selectedOpponent !== "All" && game.opponent !== selectedOpponent) matches = false;

        if (dateFrom && new Date(game.date) < new Date(dateFrom)) matches = false;
        if (dateTo && new Date(game.date) > new Date(dateTo)) matches = false;

        return matches;
    });
}

function calculateAndRenderStats(games) {
    const totalCurrentStats = {
        pts: 0, reb: 0, ast: 0,
        stl: 0, blk: 0, to: 0,
        fgm: 0, fga: 0,
        ftm: 0, fta: 0
    };

    let bestGame = games[0];

    games.forEach(game => {
        totalCurrentStats.pts += game.points;
        totalCurrentStats.reb += game.rebounds;
        totalCurrentStats.ast += game.assists;
        totalCurrentStats.stl += game.steals;
        totalCurrentStats.blk += game.blocks;
        totalCurrentStats.to += game.turnovers;
        totalCurrentStats.fgm += game.fgm;
        totalCurrentStats.fga += game.fga;
        totalCurrentStats.ftm += game.ftm;
        totalCurrentStats.fta += game.fta;

        // Find Best Game (by Points)
        if (game.points > bestGame.points) bestGame = game;
    });

    const count = games.length;

    // Averages
    animateValue(elements.avgPts, 0, (totalCurrentStats.pts / count), 1000, 1);
    animateValue(elements.avgReb, 0, (totalCurrentStats.reb / count), 1000, 1);
    animateValue(elements.avgAst, 0, (totalCurrentStats.ast / count), 1000, 1);

    // Highlights
    elements.gamesPlayed.textContent = count;
    animateValue(elements.bestGamePts, 0, bestGame.points, 1000, 0);
    elements.bestGameContext.textContent = `vs ${bestGame.opponent} (${formatDate(bestGame.date)})`;

    // Efficiency (PER Approximation): (Pts + Reb + Ast + Stl + Blk) - (FGA - FGM) - (FTA - FTM) - TO
    const efficiency = (
        (totalCurrentStats.pts + totalCurrentStats.reb + totalCurrentStats.ast + totalCurrentStats.stl + totalCurrentStats.blk)
        - (totalCurrentStats.fga - totalCurrentStats.fgm)
        - (totalCurrentStats.fta - totalCurrentStats.ftm)
        - totalCurrentStats.to
    ) / count;

    animateValue(elements.efficiencyRating, 0, efficiency, 1000, 1);
}

function renderTable(games) {
    elements.tableBody.innerHTML = '';

    games.forEach(game => {
        const isWin = game.result.startsWith('W');
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${formatDate(game.date)}</td>
            <td><div class="d-flex align-items-center"><img src="https://ui-avatars.com/api/?name=${game.opponent.replace(' ', '+')}&background=random&color=fff&rounded=true&size=24" class="me-2">${game.opponent}</div></td>
            <td class="${isWin ? 'win' : 'loss'}">${game.result}</td>
            <td class="text-center fw-bold text-primary">${game.points}</td>
            <td class="text-center text-info">${game.rebounds}</td>
            <td class="text-center text-success">${game.assists}</td>
            <td class="text-center">${game.steals}</td>
            <td class="text-center">${game.blocks}</td>
            <td class="text-center">${game.turnovers}</td>
            <td class="text-center">${game.fgm}/${game.fga}</td>
            <td class="text-center">${game.threepm}/${game.threepa}</td>
            <td class="text-center">${game.ftm}/${game.fta}</td>
        `;
        elements.tableBody.appendChild(tr);
    });
}

function renderCharts(games) {
    // Destroy existing charts to prevent overlap
    Object.values(charts).forEach(chart => chart.destroy());

    // Sort games chronologically for line chart
    const sortedGames = [...games].sort((a, b) => new Date(a.date) - new Date(b.date));

    const dates = sortedGames.map(g => formatDate(g.date, true));
    const points = sortedGames.map(g => g.points);
    const assists = sortedGames.map(g => g.assists);

    // 1. Points Line Chart
    const ctxLine = document.getElementById('pointsLineChart').getContext('2d');

    // Gradient logic
    const gradient = ctxLine.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(82, 113, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(82, 113, 255, 0.01)');

    charts.line = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Points Scored',
                data: points,
                borderColor: '#5271ff',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#0c0f1a',
                pointBorderColor: '#5271ff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4 // Smooth curves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20, 24, 41, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#5271ff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `${context.parsed.y} PTS vs ${sortedGames[context.dataIndex].opponent}`;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // 2. Shooting Profile Doughnut
    let totalFGA = 0, totalFGM = 0, total3PA = 0, total3PM = 0;
    games.forEach(g => {
        totalFGA += g.fga; totalFGM += g.fgm;
        total3PA += g.threepa; total3PM += g.threepm;
    });

    const twoPA = totalFGA - total3PA;
    const twoPM = totalFGM - total3PM;
    const missed2 = twoPA - twoPM;
    const missed3 = total3PA - total3PM;

    const ctxPie = document.getElementById('shootingDoughnutChart').getContext('2d');
    charts.pie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['2PT Made', '2PT Missed', '3PT Made', '3PT Missed'],
            datasets: [{
                data: [twoPM, missed2, total3PM, missed3],
                backgroundColor: [
                    '#5271ff', // Primary
                    'rgba(82, 113, 255, 0.2)',
                    '#00d284', // Success
                    'rgba(0, 210, 132, 0.2)'
                ],
                borderWidth: 2,
                borderColor: '#0c0f1a',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const perc = ((value / total) * 100).toFixed(1);
                            return ` ${context.label}: ${value} (${perc}%)`;
                        }
                    }
                }
            }
        }
    });

    // 3. Points vs Assists Bar Chart
    const ctxBar = document.getElementById('ptsAstBarChart').getContext('2d');
    charts.bar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Points',
                    data: points,
                    backgroundColor: '#5271ff',
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Assists',
                    data: assists,
                    backgroundColor: '#00d284',
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true } }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function showNoDataState() {
    elements.tableBody.innerHTML = '';
    elements.noDataMsg.classList.remove('d-none');

    ['avgPts', 'avgReb', 'avgAst', 'bestGamePts', 'efficiencyRating', 'gamesPlayedCount'].forEach(id => {
        document.getElementById(id).textContent = '0';
    });
    elements.bestGameContext.textContent = 'No games';

    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
}

function hideNoDataState() {
    elements.noDataMsg.classList.add('d-none');
}

// Helpers
function formatDate(dateStr, short = false) {
    const d = new Date(dateStr);
    if (short) {
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function animateValue(obj, start, end, duration, decimals = 0) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);

        let current = (start + (end - start) * easeOutQuart).toFixed(decimals);
        obj.innerHTML = current;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end.toFixed(decimals);
        }
    };
    window.requestAnimationFrame(step);
}

function exportToCSV() {
    const table = document.querySelector('.custom-table');
    let csv = [];
    for (let i = 0; i < table.rows.length; i++) {
        let row = [], cols = table.rows[i].querySelectorAll('td, th');
        for (let j = 0; j < cols.length; j++) {
            // Remove img HTML
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, "");
            data = data.replace(/"/g, '""');
            row.push('"' + data + '"');
        }
        csv.push(row.join(','));
    }
    const csvContent = "data:text/csv;charset=utf-8," + csv.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${elements.playerName.textContent}_logs.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
