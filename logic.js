// logic.js
function getPlayerPriorityScore(player, rule, now) {
    if (rule === 'rest') return player.lastMatchEndTime ? now - player.lastMatchEndTime : Infinity;
    if (rule === 'games') return -player.gamesPlayed;
    if (rule === 'combined') {
        const restScore = player.lastMatchEndTime ? (now - player.lastMatchEndTime) / 60000 : 9999;
        const gamesScore = player.gamesPlayed * -50;
        return restScore + gamesScore;
    }
    return 0;
}

function getBestPairing(group) {
    const p = group;
    const pairings = [
        [[p[0], p[1]], [p[2], p[3]]],
        [[p[0], p[2]], [p[1], p[3]]],
        [[p[0], p[3]], [p[1], p[2]]]
    ];
    let bestPairing = pairings[0];
    let minDiff = Infinity;
    for (const pairing of pairings) {
        const teamALevel = pairing[0][0].level + pairing[0][1].level;
        const teamBLevel = pairing[1][0].level + pairing[1][1].level;
        const diff = Math.abs(teamALevel - teamBLevel);
        if (diff < minDiff) {
            minDiff = diff;
            bestPairing = pairing;
        }
    }
    return [...bestPairing[0], ...bestPairing[1]];
}

export function suggestNextMatch(players, courts, suggestionRuleValue, avoidDuplicates, pairHistory) {
    let availablePlayers = players.filter(p => p.status === 'active');
    const courtsToFill = courts.filter(c => c.players.length === 0);
    if (availablePlayers.length < courtsToFill.length * 4) {
        alert('Không đủ người chơi có mặt để lấp đầy các sân trống!');
        return {};
    }

    const now = Date.now();
    availablePlayers.sort((a, b) => getPlayerPriorityScore(b, suggestionRuleValue, now) - getPlayerPriorityScore(a, suggestionRuleValue, now));

    let finalSuggestion = {};
    for (const court of courtsToFill) {
        if (availablePlayers.length < 4) break;
        let potentialGroup = availablePlayers.slice(0, 4);
        const balancedGroup = getBestPairing(potentialGroup);
        finalSuggestion[court.id] = balancedGroup;
        availablePlayers = availablePlayers.filter(p => !balancedGroup.some(selected => selected.id === p.id));
    }
    return finalSuggestion;
}