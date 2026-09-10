
    //  UTILITIES

    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    const tabRenderState = {
        legislations: false,
        committees: false,
        decree: false,
    };

    function ensureTabContent(tabName) {
        if (tabName === 'legislations' && !tabRenderState.legislations) {
            preprocessBills();
            updateLegislationControlsVisibility();
            buildFilterClouds();
            renderBills();
            renderBillCount();
            tabRenderState.legislations = true;
            return;
        }
        if (tabName === 'committees' && !tabRenderState.committees) {
            renderCommittees();
            tabRenderState.committees = true;
            return;
        }
        if (tabName === 'decree' && !tabRenderState.decree) {
            renderDecrees();
            tabRenderState.decree = true;
        }
    }

    function openTab(evt, tabName) {
        $$('.tab-content').forEach(t => t.classList.remove('active'));
        $$('.terminal-nav .terminal-btn').forEach(b => b.classList.remove('active'));
        const tab = document.getElementById(tabName);
        if (tab) tab.classList.add('active');
        if (evt?.currentTarget) {
            evt.currentTarget.classList.add('active');
        } else {
            const button = [...$$('.terminal-nav .terminal-btn')].find(b =>
                b.getAttribute('data-tab') === tabName
            );
            if (button) button.classList.add('active');
        }
        ensureTabContent(tabName);
    }

    function showNewestBillTab() {
        openTab(null, 'legislations');
        return getNewestBillSummary();
    }

    function showNewestDecreeTab() {
        openTab(null, 'decree');
        return getNewestDecreeSummary();
    }

    function showCommitteesTab() {
        openTab(null, 'committees');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/\u003c/g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isSafeCssColor(value) {
        return /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s,./%]+\)$|^hsla?\([\d\s,./%]+\)$/.test(String(value || '').trim());
    }

    function safeColor(value, fallback = '#888') {
        const color = String(value ?? '').trim();
        if (!color) return fallback;
        if (!isSafeCssColor(color)) return fallback;
        return (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('color', color))
            ? fallback
            : color;
    }

    function safeUrl(value, fallback = '') {
        const url = String(value ?? '').trim();
        if (!url || /^(?:javascript|data|vbscript|file):/i.test(url)) return fallback;
        return url;
    }

    function emptyStateHTML(message, actionHtml = '') {
        const action = actionHtml
            ? `\u003cdiv style="text-align:center;margin-top:12px;">${actionHtml}\u003c/div>`
            : '';
        return `\u003ch3 style="text-align:center;color:var(--wn-text-muted);">${escapeHtml(message)}\u003c/h3>${action}`;
    }

    function statusSlug(status) {
        return String(status || 'n-a')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'n-a';
    }

    function getTypeHTML(type) {
        const label = type || 'N/A';
        return `\u003cspan class="type-${escapeHtml(String(label).toLowerCase())}">${escapeHtml(label)}\u003c/span>`;
    }

    function getStatusHTML(status) {
        const label = status || 'N/A';
        return `\u003cspan class="status status-${statusSlug(label)}">${escapeHtml(label)}\u003c/span>`;
    }

    function parseNaturalDate(value) {
        if (!value) return new Date(NaN);
        if (typeof value === 'string') {
            const parts = value.trim().split('/');
            if (parts.length === 3) {
                const [m, d, y] = parts.map(n => parseInt(n, 10));
                if (!Number.isNaN(m) && !Number.isNaN(d) && !Number.isNaN(y)) {
                    return new Date(y, m - 1, d);
                }
            }
        }
        return new Date(value);
    }

    function formatDisplayDate(value) {
        const raw = String(value ?? '').trim();
        if (!raw || !Number.isFinite(displayDateYearOffset) || displayDateYearOffset === 0) return raw;

        const shiftYear = (year) => String(Number(year) + displayDateYearOffset).padStart(4, '0');
        const isoMatch = raw.match(/^(\d{4})(-\d{2}-\d{2}(?:[T ][\s\S]*)?)$/);
        if (isoMatch) return `${shiftYear(isoMatch[1])}${isoMatch[2]}`;

        const slashMatch = raw.match(/^(\d{1,2}\/\d{1,2}\/)(\d{4})(.*)$/);
        if (slashMatch) return `${slashMatch[1]}${shiftYear(slashMatch[2])}${slashMatch[3]}`;

        return raw.replace(/\b(\d{4})\b/, year => shiftYear(year));
    }

    function getNumberSuffix(value) {
        if (typeof value !== 'string') return 0;
        const match = value.trim().match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) || 0 : 0;
    }

    function getSessionPrefix(value) {
        if (typeof value !== 'string') return '';
        return value.split('-')[0]?.trim() || '';
    }

    function formatSessionLabel(value) {
        const session = getSessionPrefix(value);
        if (!session) return 'Session Unknown';
        return `Session ${session}`;
    }

    function getClassOverrideList(value) {
        if (!value) return [];
        if (Array.isArray(value)) {
            return value.flatMap(item => getClassOverrideList(item));
        }
        return String(value)
            .split(/\s+/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    function hasPinnedClass(value) {
        return getClassOverrideList(value).includes('pinned');
    }

    function getCategoryColor(category, colorMap) {
        if (!category || !colorMap) return '';
        if (colorMap[category]) return colorMap[category];
        if (/s$/i.test(category)) {
            const singular = category.replace(/s$/i, '');
            if (colorMap[singular]) return colorMap[singular];
        } else if (colorMap[category + 's']) {
            return colorMap[category + 's'];
        }
        return '';
    }

    function formatCommitteeCategorySectionTitle(category) {
        const base = String(category || 'Committee').trim() || 'Committee';
        return /s$/i.test(base) ? base : `${base}s`;
    }

    function getBillActivityDate(bill) {
        return bill?.modified || bill?.introduced || '';
    }

    function getNewestItem(items, dateGetter = item => item?.date) {
        if (!Array.isArray(items) || !items.length) return null;
        return items.reduce((latest, item) => {
            const itemDateValue = dateGetter(item);
            if (!item || !itemDateValue) return latest;
            if (!latest) return item;
            const latestDate = parseNaturalDate(dateGetter(latest));
            const itemDate = parseNaturalDate(itemDateValue);
            return itemDate > latestDate ? item : latest;
        }, null);
    }

    function getNewestDecreeItem(items) {
        if (!Array.isArray(items) || !items.length) return null;

        let newest = null;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item || !item.date) continue;

            const itemDate = parseNaturalDate(item.date);
            if (Number.isNaN(itemDate.getTime())) continue;

            if (!newest) {
                newest = item;
                continue;
            }

            const newestDate = parseNaturalDate(newest.date);
            if (itemDate > newestDate) {
                newest = item;
            } else if (itemDate.getTime() === newestDate.getTime()) {
                const newestSuffix = getNumberSuffix(newest.number);
                const itemSuffix = getNumberSuffix(item.number);
                if (itemSuffix > newestSuffix) newest = item;
            }
        }

        return newest;
    }

    function getNewestBill() {
        return getNewestItem(bills, getBillActivityDate);
    }

    function getNewestDecree() {
        return getNewestDecreeItem(decrees);
    }

    function getNewestBillSummary() {
        const bill = getNewestBill();
        return bill ? {
            title: bill.title || 'Untitled Bill',
            type: bill.type || 'Unknown',
            status: bill.status || 'Unknown',
            introduced: bill.introduced || 'Unknown',
            modified: bill.modified || 'Unknown',
            link: bill.link?.trim() || null
        } : null;
    }

    function getNewestDecreeSummary() {
        const decree = getNewestDecree();
        if (!decree) return null;

        const { resolvedStatus } = getDecreeExpiry(decree);

        return {
            title: decree.title || 'Untitled Decree',
            category: decree.category || 'General',
            status: resolvedStatus || decree.status || 'Unknown',
            date: decree.date || 'Unknown'
        };
    }

    let featuredCommitteeIndex = null;

    function getCommitteeFeedSummary() {
        const list = Array.isArray(committees) ? committees : [];
        if (!list.length) {
            featuredCommitteeIndex = null;
            return {
                hasData: false,
                lead: null,
                activeCount: 0,
                totalCount: 0,
                overflow: 0,
            };
        }

        if (
            featuredCommitteeIndex == null ||
            featuredCommitteeIndex < 0 ||
            featuredCommitteeIndex >= list.length
        ) {
            featuredCommitteeIndex = Math.floor(Math.random() * list.length);
        }

        const lead = list[featuredCommitteeIndex];
        const activeCount = list.filter(c =>
            String(c.status || '').toLowerCase() === 'active'
        ).length;
        const totalCount = list.length;
        const overflow = Math.max(0, totalCount - 1);

        return {
            hasData: true,
            lead: {
                title: lead.title || 'Untitled Committee',
                category: lead.category || 'Committee',
                status: lead.status || 'inactive',
                pinned: hasPinnedClass(lead.classOverride),
            },
            activeCount,
            totalCount,
            overflow,
        };
    }

    function createLatestMetaLine(prefixText, statusText) {
        const metaSpan = document.createElement('span');
        metaSpan.className = 'latest-entry-meta';
        const prefix = document.createElement('span');
        prefix.className = 'latest-entry-meta-prefix';
        prefix.textContent = prefixText;
        metaSpan.appendChild(prefix);
        if (statusText) {
            metaSpan.appendChild(document.createTextNode(' · '));
            const statusWrap = document.createElement('span');
            statusWrap.className = 'latest-entry-status';
            statusWrap.innerHTML = getStatusHTML(statusText);
            metaSpan.appendChild(statusWrap);
        }
        return metaSpan;
    }

    function updateLatestEntries() {
        if (dom.newestBill) {
            const summary = getNewestBillSummary();
            dom.newestBill.innerHTML = '';
            dom.newestBill.style.cursor = 'pointer';
            dom.newestBill.onclick = () => showNewestBillTab();

            if (summary) {
                const titleSpan = document.createElement('span');
                titleSpan.textContent = summary.title;

                const metaSpan = createLatestMetaLine(summary.type || 'Unknown', summary.status);

                dom.newestBill.appendChild(titleSpan);
                dom.newestBill.appendChild(metaSpan);

                if (summary.link) {
                    const linkAnchor = document.createElement('a');
                    linkAnchor.href = summary.link;
                    linkAnchor.target = '_blank';
                    linkAnchor.rel = 'noopener';
                    linkAnchor.textContent = 'source';
                    linkAnchor.style.cssText = 'margin-left:8px;color:var(--wn-accent);font-size:10px;text-decoration:none;';
                    linkAnchor.addEventListener('click', e => e.stopPropagation());

                    metaSpan.appendChild(document.createTextNode(' '));
                    metaSpan.appendChild(linkAnchor);
                }
            } else {
                dom.newestBill.textContent = 'No latest legislation';
                dom.newestBill.style.cursor = 'default';
                dom.newestBill.onclick = null;
            }
        }

        if (dom.newestDecree) {
            const summary = getNewestDecreeSummary();
            dom.newestDecree.innerHTML = '';
            dom.newestDecree.style.cursor = 'pointer';
            dom.newestDecree.onclick = () => showNewestDecreeTab();

            if (summary) {
                const titleSpan = document.createElement('span');
                titleSpan.textContent = summary.title;

                const metaSpan = createLatestMetaLine(summary.category || 'General', summary.status);

                dom.newestDecree.appendChild(titleSpan);
                dom.newestDecree.appendChild(metaSpan);
            } else {
                dom.newestDecree.textContent = 'No latest decree';
                dom.newestDecree.style.cursor = 'default';
                dom.newestDecree.onclick = null;
            }
        }

        if (dom.newestCommittee) {
            const feed = getCommitteeFeedSummary();
            dom.newestCommittee.innerHTML = '';

            if (!feed.hasData) {
                dom.newestCommittee.textContent = 'No committees';
                dom.newestCommittee.style.cursor = 'default';
                dom.newestCommittee.onclick = null;
            } else {
                dom.newestCommittee.style.cursor = 'pointer';
                dom.newestCommittee.onclick = () => showCommitteesTab();

                const titleSpan = document.createElement('span');
                titleSpan.textContent = feed.lead.title;

                const inactiveCount = Math.max(0, feed.totalCount - feed.activeCount);
                const metaSpan = createLatestMetaLine(
                    feed.lead.category || 'Committee',
                    feed.lead.status
                );
                if (feed.activeCount > 0 || inactiveCount > 0) {
                    const counts = document.createElement('span');
                    counts.className = 'latest-entry-meta-prefix';
                    const countBits = [`${feed.activeCount} active`];
                    if (inactiveCount > 0) countBits.push(`+${inactiveCount} more`);
                    counts.textContent = ` · ${countBits.join(' · ')}`;
                    metaSpan.appendChild(counts);
                }

                dom.newestCommittee.appendChild(titleSpan);
                dom.newestCommittee.appendChild(metaSpan);
            }
        }
    }

    //  OVERVIEW RENDERERS

    function renderAssemblyComposition() {
        const overseer = roster.find(m => m.rank === 'Overseer');
        const chairperson = roster.find(m => m.rank === 'Chairperson');

        const oSlot = $('#overseer-slot');
        if (oSlot) {
            oSlot.querySelector('h3').textContent = overseer ? overseer.name : 'VACANT';
            oSlot.querySelector('span:last-child').textContent = overseer ? overseer.cid : 'N/A';
        }

        const cSlot = $('#chairperson-slot');
        if (cSlot) {
            cSlot.querySelector('h3').textContent = chairperson ? chairperson.name : 'VACANT';
            cSlot.querySelector('span:last-child').textContent = chairperson ? chairperson.cid : 'N/A';
        }
    }

    function isRosterWingsEnabled() {
        return Number(showRosterWings) === 1;
    }

    function getRosterMemberAffiliation(member) {
        const col = member.partyColor || partyColorMap[member.party] || '#888';
        const coalition = getCoalitionForMember(member);
        const coalColor = (coalition && coalition.color) ? coalition.color : '';

        let wing = null;
        let wingValid = false;
        let wingColor = '';
        if (isRosterWingsEnabled() && member.name) {
            wing = getWingForCouncillor(member.name);
            wingValid = !!(wing && (!member.party || !wing.party || member.party === wing.party));
            wingColor = wingValid ? (getWingAccentColor(wing) || col) : '';
        }

        const affilParts = [];
        if (coalition && coalition.name) {
            affilParts.push(
                `\u003cdiv class="roster-affil-coalition">${escapeHtml(coalition.name)}\u003c/div>`
            );
        }
        if (wingValid && wing.name) {
            affilParts.push(
                `\u003cdiv class="roster-affil-wing" title="${escapeHtml(wing.name)}">${escapeHtml(wing.name)}\u003c/div>`
            );
        }

        return {
            hasContent: affilParts.length > 0,
            html: affilParts.join(''),
            coalColor,
            wingColor,
        };
    }

    function createRosterSectionRow(label, colCount = 4) {
        const tr = document.createElement('tr');
        tr.className = 'roster-section';
        tr.innerHTML = `\u003ctd colspan="${colCount}">${escapeHtml(label)}\u003c/td>`;
        return tr;
    }

    function createRosterRow(member, includeAffiliation = false) {
        const tr = document.createElement('tr');
        tr.className = 'roster-member';
        const col = member.partyColor || partyColorMap[member.party] || '#888';
        const partyColor = safeColor(col);
        const isChair = member.rank === 'Chairperson';
        const partyHTML = member.party
            ? `\u003cspan style="color:${partyColor}">●\u003c/span> ${escapeHtml(member.party)}`
            : '\u003cspan style="color:#666;font-style:italic;">\u003c/span>';

        let affiliationCell = '';
        if (includeAffiliation) {
            const affil = getRosterMemberAffiliation(member);
            if (affil.coalColor) tr.style.setProperty('--coalition-color', safeColor(affil.coalColor));
            if (affil.wingColor) tr.style.setProperty('--wing-color', safeColor(affil.wingColor));
            affiliationCell = `\u003ctd class="col-affiliation">${affil.html}\u003c/td>`;
        }

        tr.innerHTML = `
            \u003ctd class="col-rank">\u003cspan class="roster-rank-badge${isChair ? ' chair' : ''}">${escapeHtml(member.rank || '—')}\u003c/span>\u003c/td>
            \u003ctd class="col-name">${escapeHtml(member.name || '—')}\u003c/td>
            \u003ctd class="col-cid">${escapeHtml(member.cid || '')}\u003c/td>
            \u003ctd class="col-party">${partyHTML}\u003c/td>
            ${affiliationCell}
        `;
        return tr;
    }

    function getRosterSectionLabel(rank) {
        if (rank === 'Chairperson') return 'Chairpersons';
        if (rank === 'Councillor') return 'Councillors';
        if (rank === 'Overseer') return 'Overseers';
        return `${rank || 'Other'}s`;
    }

    function renderRoster() {
        if (!dom.rosterTbody) return;
        dom.rosterTbody.innerHTML = '';

        const visibleMembers = roster.filter(member => member.rank !== 'Overseer');
        const includeAffiliation = visibleMembers.some(member => getRosterMemberAffiliation(member).hasContent);
        const colCount = includeAffiliation ? 5 : 4;

        const rankOrder = ['Chairperson', 'Councillor'];
        const byRank = new Map();

        visibleMembers.forEach(member => {
            const rank = member.rank || 'Other';
            if (!byRank.has(rank)) byRank.set(rank, []);
            byRank.get(rank).push(member);
        });

        const ranks = [
            ...rankOrder.filter(r => byRank.has(r)),
            ...[...byRank.keys()].filter(r => !rankOrder.includes(r))
        ];

        const frag = document.createDocumentFragment();
        ranks.forEach(rank => {
            const members = byRank.get(rank) || [];
            if (!members.length) return;
            frag.appendChild(createRosterSectionRow(getRosterSectionLabel(rank), colCount));
            members.forEach(member => frag.appendChild(createRosterRow(member, includeAffiliation)));
        });

        dom.rosterTbody.appendChild(frag);
    }

    function getCurrentParties() {
        return Array.isArray(parties) ? parties : [];
    }

    function rebuildPartyColorMap() {
        Object.keys(partyColorMap).forEach(k => { delete partyColorMap[k]; });
        getCurrentParties().forEach(p => {
            if (p && p.name) partyColorMap[p.name] = p.color;
        });
        (partyArchive || []).forEach(p => {
            if (p && p.name && partyColorMap[p.name] == null) partyColorMap[p.name] = p.color;
        });
    }

    function getResolvedTotalSeats() {
        const assignedSeats = parties.reduce((sum, party) => sum + (Number(party.seats) || 0), 0);
        return Number.isFinite(totalSeats) && totalSeats > 0 ? totalSeats : assignedSeats;
    }

    function getCoalitionForParty(party) {
        if (!party || !party.name) return null;

        return coalitions.find(c =>
            Array.isArray(c.parties) && c.parties.includes(party.name)
        ) || null;
    }

    function getCoalitionForMember(member) {
        if (!member) return null;
        if (member.party) {
            const byParty = getCoalitionForParty({ name: member.party });
            if (byParty) return byParty;
        }
        const memberName = String(member.name || '').trim();
        if (!memberName) return null;
        for (const coalition of coalitions) {
            const overrides = getCoalitionMemberOverrides(coalition);
            if (overrides.some(entry => entry.name === memberName)) return coalition;
        }
        return null;
    }

    function getSeatStrokeForParty(party) {
        const coalition = getCoalitionForParty(party);
        if (!coalition) return '';
        return (coalition.stroke || coalition.color || '').trim();
    }

    function applyCoalitionFocusStroke() {
        const wingCoalitions = activeSeatFocusWing
            ? getCoalitionsForFocusParties(activeSeatFocusParties)
            : null;
        getSeatCircles().forEach(c => {
            const party = c.getAttribute('data-party') || '';
            if (!party || party === 'Vacant') return;

            const coalStroke = (c.getAttribute('data-coalition-stroke') || '').trim();
            const showStroke = !!coalStroke && shouldRevealSeatStyle(c, wingCoalitions);

            c.setAttribute('stroke', showStroke ? coalStroke : 'none');
            c.setAttribute('stroke-width', showStroke ? String(coalitionStrokeWidth) : '0');
        });
    }

    function cssColorToRgb(color) {
        if (color == null) return null;
        const s = String(color).trim();
        if (!s) return null;
        const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            let h = hex[1];
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            return {
                r: parseInt(h.slice(0, 2), 16),
                g: parseInt(h.slice(2, 4), 16),
                b: parseInt(h.slice(4, 6), 16)
            };
        }
        const rgb = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
        if (rgb) {
            return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
        }
        try {
            if (!cssColorToRgb._ctx) {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                cssColorToRgb._ctx = canvas.getContext('2d', { willReadFrequently: true });
            }
            const ctx = cssColorToRgb._ctx;
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = '#000';
            ctx.fillStyle = s;
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            return { r: d[0], g: d[1], b: d[2] };
        } catch (_) {
            return null;
        }
    }

    function rgbToHsl(r, g, b) {
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        if (max === min) return { h: 0, s: 0, l };
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h;
        if (max === rn) h = ((gn - bn) / d) + (gn < bn ? 6 : 0);
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        return { h: h * 60, s, l };
    }

    function hslToHex(h, s, l) {
        const hh = ((h % 360) + 360) % 360;
        const ss = Math.min(1, Math.max(0, s));
        const ll = Math.min(1, Math.max(0, l));
        const c = (1 - Math.abs(2 * ll - 1)) * ss;
        const x = c * (1 - Math.abs((hh / 60) % 2 - 1));
        const m = ll - c / 2;
        let rp = 0, gp = 0, bp = 0;
        if (hh < 60) { rp = c; gp = x; }
        else if (hh < 120) { rp = x; gp = c; }
        else if (hh < 180) { gp = c; bp = x; }
        else if (hh < 240) { gp = x; bp = c; }
        else if (hh < 300) { rp = x; bp = c; }
        else { rp = c; bp = x; }
        const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
    }

    function cssColorToHex(color) {
        const rgb = cssColorToRgb(color);
        if (!rgb) return '';
        const toHex = (n) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
        return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
    }

    function getWingVariantIndex(wing) {
        if (!wing || !wing.name || !wing.party) return 0;
        const list = getWingsForParty(wing.party);
        const idx = list.findIndex(w => w && w.name === wing.name);
        return Math.max(0, idx);
    }

    function getPartyByName(partyName) {
        if (!partyName) return null;
        const active = typeof getCurrentParties === 'function' ? getCurrentParties() : parties;
        return (active || []).find(p => p && p.name === partyName)
            || (parties || []).find(p => p && p.name === partyName)
            || (partyArchive || []).find(p => p && p.name === partyName)
            || null;
    }

    function getWingAccentColor(wing, parentParty = null) {
        if (!wing) return '';
        const parent = parentParty || getPartyByName(wing.party);
        const partyColor = (parent && parent.color) || partyColorMap[wing.party] || '#888';
        return deriveWingSeatColor(partyColor, wing, getWingVariantIndex(wing));
    }

    function getWingSeatAccentColor(wing, parentParty = null) {
        if (Number(useWingSeatColors) !== 1) return '';
        return getWingAccentColor(wing, parentParty);
    }

    function isLegendWingsEnabled() {
        return Number(showLegendWings) === 1;
    }

    function deriveWingSeatColor(partyColor, wing = null, variantIndex = 0) {
        if (wing && wing.seatColor != null && String(wing.seatColor).trim()) {
            const override = String(wing.seatColor).trim();
            if (isSafeCssColor(override) || /^[a-zA-Z]+$/.test(override)) {
                return cssColorToHex(override) || override;
            }
        }

        const baseHex = cssColorToHex(partyColor);
        const rgb = cssColorToRgb(baseHex || partyColor);
        if (!rgb) return baseHex || (partyColor || '#888');

        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const idx = Math.max(0, variantIndex | 0);
        const hueDelta = wingVariantHueOffsets[idx % wingVariantHueOffsets.length];
        const satDelta = wingVariantSatDeltas[idx % wingVariantSatDeltas.length];
        const lightDelta = wingVariantLightDeltas[idx % wingVariantLightDeltas.length];

        let s = hsl.s;
        if (s < 0.12) s = Math.min(0.2, s + 0.06);
        s = Math.min(1, Math.max(0.12, s + satDelta));

        let l = Math.min(0.8, Math.max(0.12, hsl.l + lightDelta));
        const h = (hsl.h + hueDelta + 360) % 360;
        return hslToHex(h, s, l);
    }

    function getSeatColorForParty(party) {
        if (!party) return '';
        const coalition = getCoalitionForParty(party);
        if (coalition && coalition.color) return String(coalition.color).trim();
        return party.color || '';
    }

    function getCoalitionMembers(coalition, activeParties) {
        if (!coalition || !Array.isArray(coalition.parties)) return [];
        return activeParties.filter(p => coalition.parties.includes(p.name));
    }

    function getCoalitionMemberOverrides(coalition, activeRoster = roster) {
        if (!coalition || !Array.isArray(coalition.memberOverride)) return [];
        const requested = coalition.memberOverride
            .map(entry => {
                const name = typeof entry === 'string' ? entry.trim() : String(entry?.name || '').trim();
                const party = typeof entry === 'object' ? String(entry.party || '').trim() : '';
                return name ? { name, party } : null;
            })
            .filter(Boolean);

        return requested.flatMap(request => {
            const matches = activeRoster.filter(member =>
                member?.name === request.name && (!request.party || member.party === request.party)
            );
            return matches.map(member => ({ ...member, overrideParty: request.party || member.party }));
        });
    }

    function getCoalitionMemberOverrideNames() {
        const names = new Set();
        coalitions.forEach(coalition => {
            getCoalitionMemberOverrides(coalition).forEach(member => names.add(member.name));
        });
        return names;
    }

    function getRosterMembersForParty(partyName) {
        return roster.filter(member =>
            member.party === partyName && member.rank !== 'Chairperson' && member.rank !== 'Overseer'
        );
    }

    function getCoalitionPartySegments(coalition, activeParties) {
        const segments = [];
        const overrides = getCoalitionMemberOverrides(coalition);
        const overrideNames = new Set(overrides.map(member => member.name));
        const fullPartyNames = new Set(coalition.parties || []);

        activeParties.forEach(party => {
            if (!fullPartyNames.has(party.name)) return;
            segments.push({
                party,
                partyName: party.name,
                members: getRosterMembersForParty(party.name),
                seats: Math.max(0, Number(party.seats) || 0),
                membershipKind: 'full',
                coalition,
            });
        });

        const overrideParties = [...new Set(overrides.map(member => member.overrideParty))];
        overrideParties.forEach(partyName => {
            if (fullPartyNames.has(partyName)) return;
            const party = activeParties.find(entry => entry.name === partyName);
            const members = overrides.filter(member => member.overrideParty === partyName);
            if (!party || !members.length) return;
            segments.push({
                party,
                partyName,
                members,
                seats: Math.min(Math.max(0, Number(party.seats) || 0), members.length),
                membershipKind: 'override',
                coalition,
            });
        });

        return { segments, overrideNames };
    }

    function getCoalitionSeatTotalFromSegments(segments) {
        return segments.reduce((total, segment) => total + segment.seats, 0);
    }

    function getCoalitionSeatTotal(members) {
        return members.reduce((sum, p) => sum + (Number(p.seats) || 0), 0);
    }

    function getPartyOrderIndex(partyName, activeParties) {
        const idx = activeParties.findIndex(party => party.name === partyName);
        return idx < 0 ? Number.MAX_SAFE_INTEGER : idx;
    }

    function sortSegmentsByPartyOrder(segments, activeParties) {
        return [...segments].sort((left, right) =>
            getPartyOrderIndex(left.partyName, activeParties) - getPartyOrderIndex(right.partyName, activeParties)
        );
    }

    function getCoalitionAnchorSegment(segments, activeParties) {
        let best = null;
        let bestSeats = -1;
        let bestIdx = Number.MAX_SAFE_INTEGER;
        (segments || []).forEach(segment => {
            const seats = Math.max(0, Number(segment.seats) || 0);
            const idx = getPartyOrderIndex(segment.partyName, activeParties);
            if (seats > bestSeats || (seats === bestSeats && idx < bestIdx)) {
                best = segment;
                bestSeats = seats;
                bestIdx = idx;
            }
        });
        return best;
    }

    let politicalBlocsCache = null;

    function clearPoliticalBlocsCache() {
        politicalBlocsCache = null;
    }

    function getOrderedPoliticalBlocs() {
        if (politicalBlocsCache) return politicalBlocsCache;

        const activeParties = getCurrentParties();
        const overriddenNames = getCoalitionMemberOverrideNames();
        const placementByAnchor = new Map();
        const fullPartyNames = new Set();
        const emittedCoalitions = new Set();
        const blocs = [];

        coalitions.forEach((coalition, coalitionIndex) => {
            const { segments } = getCoalitionPartySegments(coalition, activeParties);
            if (!segments.length) return;
            const sorted = sortSegmentsByPartyOrder(segments, activeParties);
            const anchor = getCoalitionAnchorSegment(sorted, activeParties);
            if (!anchor) return;
            const key = coalition.name || `__coalition_${coalitionIndex}`;
            placementByAnchor.set(anchor.partyName, {
                key,
                coalition,
                segments: sorted,
            });
            sorted.forEach(segment => {
                if (segment.membershipKind === 'full') fullPartyNames.add(segment.partyName);
            });
        });

        const pushNativeRemainder = (party) => {
            if (fullPartyNames.has(party.name)) return;
            const members = getRosterMembersForParty(party.name);
            const remainingMembers = members.filter(member => !overriddenNames.has(member.name));
            const hasOverride = remainingMembers.length !== members.length;
            const seats = hasOverride
                ? Math.max(0, (Number(party.seats) || 0) - members.filter(member => overriddenNames.has(member.name)).length)
                : Number(party.seats) || 0;
            // Keep parties that still have seats even with no named roster members (unassigned seats).
            if (seats <= 0 && !remainingMembers.length) return;
            blocs.push({
                kind: 'native',
                segment: {
                    party,
                    partyName: party.name,
                    members: remainingMembers,
                    seats,
                    membershipKind: 'native',
                    coalition: null,
                },
            });
        };

        activeParties.forEach(party => {
            const placement = placementByAnchor.get(party.name);
            if (placement && !emittedCoalitions.has(placement.key)) {
                blocs.push({
                    kind: 'coalition',
                    coalition: placement.coalition,
                    segments: placement.segments,
                });
                emittedCoalitions.add(placement.key);
                if (!fullPartyNames.has(party.name)) pushNativeRemainder(party);
                return;
            }
            if (fullPartyNames.has(party.name)) return;
            pushNativeRemainder(party);
        });

        coalitions.forEach((coalition, coalitionIndex) => {
            const key = coalition.name || `__coalition_${coalitionIndex}`;
            if (emittedCoalitions.has(key)) return;
            const { segments } = getCoalitionPartySegments(coalition, activeParties);
            if (!segments.length) return;
            blocs.push({
                kind: 'coalition',
                coalition,
                segments: sortSegmentsByPartyOrder(segments, activeParties),
            });
            emittedCoalitions.add(key);
        });

        politicalBlocsCache = blocs;
        return blocs;
    }

    function getDisplayOrderedParties() {
        return getOrderedPoliticalBlocs().flatMap(bloc =>
            bloc.kind === 'coalition' ? bloc.segments : [bloc.segment]
        );
    }

    function formatSeatPortion(count, ofTotal = null, { unit = false } = {}) {
        const n = Math.max(0, Number(count) || 0);
        const total = ofTotal == null ? null : Number(ofTotal);
        const hasTotal = total != null && Number.isFinite(total) && total > 0;
        let text = '';
        if (hasTotal) {
            text = `${n}/${total}`;
        } else if (n > 0) {
            text = String(n);
        } else {
            return '';
        }
        if (unit && !hasTotal) {
            text += n === 1 ? ' seat' : ' seats';
        }
        return text;
    }

    function seatPortionTitle(count, ofTotal, parentLabel) {
        const n = Math.max(0, Number(count) || 0);
        const total = ofTotal == null ? null : Number(ofTotal);
        if (total != null && Number.isFinite(total) && total > 0 && parentLabel) {
            return `${n} of ${total} seats in ${parentLabel}`;
        }
        if (total != null && Number.isFinite(total) && total > 0) {
            return `${n} of ${total} seats`;
        }
        if (n > 0) return `${n} ${n === 1 ? 'seat' : 'seats'}`;
        return '';
    }

    function createLegendItem(name, color, options = {}) {
        const el = document.createElement('div');
        el.className = 'party-legend-item';
        if (options.extraClass) el.classList.add(options.extraClass);
        el.dataset.legendKind = options.kind || 'party';
        if (options.partyName) el.dataset.party = options.partyName;
        if (options.coalitionName) el.dataset.coalition = options.coalitionName;
        if (options.wingName) el.dataset.wing = options.wingName;
        if (options.coalitionStroke) {
            el.style.setProperty('--legend-coalition-stroke', safeColor(options.coalitionStroke));
        }
        if (options.partyStroke) {
            el.style.setProperty('--legend-party-stroke', safeColor(options.partyStroke));
        }
        const swatchColor = safeColor(color);
        el.innerHTML = `
            \u003cspan class="party-legend-swatch" style="background:${swatchColor};">\u003c/span>
            \u003cspan class="party-legend-label">${escapeHtml(name)}\u003c/span>
        `;
        return el;
    }

    function appendLegendPartyBlock(parent, party, options = {}) {
        if (!parent || !party) return;

        const kind = options.kind || 'party';
        const coalName = options.coalitionName || '';
        const coalStroke = options.coalitionStroke || '';
        const partyItem = createLegendItem(party.name, party.color, {
            kind,
            partyName: party.name,
            coalitionName: coalName,
            coalitionStroke: coalStroke
        });

        const wings = getWingsForParty(party.name);
        if (!wings.length) {
            parent.appendChild(partyItem);
            return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'party-legend-party-with-wings';
        wrap.dataset.party = party.name || '';
        wrap.appendChild(partyItem);

        const wingsWrap = document.createElement('div');
        wingsWrap.className = 'party-legend-wings';
        const partyStroke = (party.color || '').trim();
        wings.forEach(w => {
            const accent = getWingAccentColor(w, party) || party.color || '#888';
            wingsWrap.appendChild(createLegendItem(w.name || 'Wing', accent, {
                kind: 'wing',
                partyName: party.name,
                wingName: w.name || '',
                coalitionName: coalName,
                partyStroke
            }));
        });
        wrap.appendChild(wingsWrap);
        parent.appendChild(wrap);
    }

    function renderPartyLegend() {
        if (!dom.partyLegend) return;
        dom.partyLegend.innerHTML = '';
        clearPoliticalBlocsCache();

        getOrderedPoliticalBlocs().forEach(bloc => {
            if (bloc.kind === 'coalition') {
                const { coalition, segments } = bloc;
                const group = document.createElement('div');
                group.className = 'party-legend-coalition';
                group.dataset.coalition = coalition.name || '';

                const coalColor = coalition.color || segments[0].party.color;
                const coalStroke = (coalition.stroke || coalition.color || coalColor || '').trim();
                group.appendChild(createLegendItem(coalition.name || 'Coalition', coalColor, {
                    kind: 'coalition',
                    coalitionName: coalition.name || '',
                    extraClass: 'party-legend-coalition-summary'
                }));

                const membersWrap = document.createElement('div');
                membersWrap.className = 'party-legend-coalition-members';
                segments.forEach(segment => {
                    appendLegendPartyBlock(membersWrap, segment.party, {
                        kind: 'coalition-member',
                        coalitionName: coalition.name || '',
                        coalitionStroke: coalStroke
                    });
                });
                group.appendChild(membersWrap);
                dom.partyLegend.appendChild(group);
                return;
            }

            appendLegendPartyBlock(dom.partyLegend, bloc.segment.party, { kind: 'party' });
        });

        rebuildPartyLegendIndex();
        updateLegendFocus(activeSeatFocusParties);
    }

    function isCoalitionLegendRevealed(coalition, focusParties) {
        if (!coalition) return false;
        if (activeSeatFocusCoalition === coalition.name) return true;
        if (coalition.name && expandedCoalitionNames.has(coalition.name)) return true;

        const activeParties = getCurrentParties();
        const { segments } = getCoalitionPartySegments(coalition, activeParties);
        return segments.some(segment => {
            const name = segment.partyName || segment.party?.name || '';
            if (!name) return false;
            if (expandedCoalitionPartyNames.has(name)) return true;
            if (focusParties && focusParties.has(name)) return true;
            return false;
        });
    }

    let partyLegendIndex = null;
    let partyBoxesIndex = null;

    function rebuildPartyLegendIndex() {
        if (!dom.partyLegend) {
            partyLegendIndex = null;
            return;
        }
        partyLegendIndex = {
            coalitions: Array.from(dom.partyLegend.querySelectorAll('.party-legend-coalition')),
            partyWithWings: Array.from(dom.partyLegend.querySelectorAll('.party-legend-party-with-wings')),
            wingItems: Array.from(dom.partyLegend.querySelectorAll('.party-legend-item[data-legend-kind="wing"]')),
            allItems: Array.from(dom.partyLegend.querySelectorAll('.party-legend-item')),
        };
    }

    function rebuildPartyBoxesIndex() {
        if (!dom.partyBoxes) {
            partyBoxesIndex = null;
            return;
        }
        partyBoxesIndex = {
            focusables: Array.from(dom.partyBoxes.querySelectorAll(
                '.party-roster-item, .party-with-wings, .party-coalition, .party-wing-row'
            )),
            wingRows: Array.from(dom.partyBoxes.querySelectorAll('.party-wing-row')),
            coalitions: Array.from(dom.partyBoxes.querySelectorAll('.party-coalition')),
            topLevel: Array.from(dom.partyBoxes.querySelectorAll(
                ':scope > .party-roster-item, :scope > .party-with-wings, :scope > .party-coalition'
            )),
            topLevelPartyRows: Array.from(dom.partyBoxes.querySelectorAll(
                ':scope > .party-roster-item, :scope > .party-with-wings > .party-roster-item'
            )),
            topLevelCoalitions: Array.from(dom.partyBoxes.querySelectorAll(':scope > .party-coalition')),
        };
    }

    function updateLegendFocus(focusParties) {
        if (!dom.partyLegend) return;
        if (!partyLegendIndex) rebuildPartyLegendIndex();
        const index = partyLegendIndex;
        if (!index) return;

        index.coalitions.forEach(group => {
            const coalName = group.dataset.coalition || '';
            const coalition = coalitions.find(c => c.name === coalName);
            group.classList.toggle('revealed', isCoalitionLegendRevealed(coalition, focusParties));
        });

        const seatWing = (typeof activeSeatFocusWing === 'string' && activeSeatFocusWing)
            ? activeSeatFocusWing
            : '';
        const legendWingsOn = isLegendWingsEnabled();

        let anyWingsVisible = false;
        index.partyWithWings.forEach(block => {
            const partyName = block.dataset.party || '';
            const rosterWingOpen = !!(partyName && expandedWingPartyNames.has(partyName));
            const partyInFocus = !!(partyName && focusParties && focusParties.has(partyName));
            const forceWing = !!(seatWing && partyInFocus);

            const revealed = legendWingsOn && (rosterWingOpen || forceWing);
            block.classList.toggle('wings-revealed', revealed);
            block.classList.toggle('wings-forced', forceWing && !revealed);

            if (revealed || (forceWing && !revealed)) anyWingsVisible = true;
        });
        dom.partyLegend.classList.toggle('has-wings-revealed', anyWingsVisible);

        index.wingItems.forEach(el => {
            const isForced = !!(seatWing && el.dataset.wing === seatWing);
            el.classList.toggle('legend-wing-forced', isForced);
        });

        if (!focusParties) {
            index.allItems.forEach(el => {
                el.classList.remove('legend-dimmed');
            });
            return;
        }

        index.allItems.forEach(el => {
            const kind = el.dataset.legendKind || 'party';
            let inFocus = false;
            if (kind === 'coalition') {
                const coalName = el.dataset.coalition || '';
                if (coalName && coalName === activeSeatFocusCoalition) {
                    inFocus = true;
                } else {
                    const coalition = coalitions.find(c => c.name === coalName);
                    if (coalition) {
                        const { segments } = getCoalitionPartySegments(coalition, getCurrentParties());
                        inFocus = segments.some(segment => focusParties.has(segment.partyName));
                    }
                }
            } else if (kind === 'coalition-member') {
                const coalName = el.closest('.party-legend-coalition')?.dataset.coalition || '';
                inFocus = (coalName && coalName === activeSeatFocusCoalition)
                    || focusParties.has(el.dataset.party || '');
            } else if (kind === 'wing') {
                const partyName = el.dataset.party || '';
                if (!partyName || !focusParties.has(partyName)) {
                    inFocus = false;
                } else if (seatWing) {
                    inFocus = el.dataset.wing === seatWing;
                } else if (!legendWingsOn) {
                    inFocus = false;
                } else {
                    inFocus = true;
                }
            } else {
                const partyName = el.dataset.party || '';
                inFocus = !!(partyName && focusParties.has(partyName));
            }
            el.classList.toggle('legend-dimmed', !inFocus);
        });
    }

    function getWingsForParty(partyName) {
        if (!partyName || !Array.isArray(partyWings)) return [];
        return partyWings.filter(w => w && w.party === partyName && w.name);
    }

    function getWingByName(wingName, options = {}) {
        if (!wingName) return null;
        const includeArchive = options.includeArchive !== false;
        const active = (partyWings || []).find(w => w && w.name === wingName) || null;
        if (active) return active;
        if (!includeArchive) return null;
        return (partyWingsArchive || []).find(w => w && w.name === wingName) || null;
    }

    function getWingMemberNames(wing) {
        if (!wing || !Array.isArray(wing.members)) return [];
        return wing.members
            .filter(m => typeof m === 'string' && m.trim())
            .map(m => m.trim());
    }

    function wingHasMember(wing, councillorName) {
        if (!wing || !councillorName) return false;
        const name = String(councillorName).trim();
        return getWingMemberNames(wing).some(m => m === name);
    }

    function getWingForCouncillor(councillorName, options = {}) {
        if (!councillorName) return null;
        const name = String(councillorName).trim();
        if (!name) return null;

        const includeArchive = options.includeArchive === true;

        const active = (partyWings || []).find(w => wingHasMember(w, name));
        if (active) {
            const rosterMember = (roster || []).find(m => m && m.name === name);
            if (rosterMember && rosterMember.party && active.party && rosterMember.party !== active.party) {
                return null;
            }
            return active;
        }

        if (!includeArchive) return null;

        const archived = (partyWingsArchive || []).find(w => wingHasMember(w, name)) || null;
        if (!archived) return null;
        const rosterMember = (roster || []).find(m => m && m.name === name);
        if (rosterMember && rosterMember.party && archived.party && rosterMember.party !== archived.party) {
            return null;
        }
        return archived;
    }

    function buildPartyCaretSlotHTML(showToggle, toggleClass = 'party-coalition-toggle', caretClass = 'party-coalition-caret', ariaLabel = 'Toggle') {
        if (!showToggle) return '';
        return `\u003cspan class="party-caret-slot">
            \u003cbutton type="button" class="roster-toggle-btn party ${toggleClass}"
                aria-expanded="false" aria-label="${escapeHtml(ariaLabel)}">
                \u003cspan class="${caretClass}">▼\u003c/span>
            \u003c/button>
        \u003c/span>`;
    }

    function buildPartyRowHTML({
        name, color, seats, ofTotal = null, ofLabel = '', logoHTML, description, showToggle,
        toggleClass, caretClass, ariaLabel, metaExtraHTML = ''
    }) {
        const seatCount = Number(seats);
        const seatsLabel = formatSeatPortion(
            seatCount,
            ofTotal != null ? ofTotal : null,
            { unit: ofTotal == null }
        );
        const seatsTitle = seatPortionTitle(seatCount, ofTotal, ofLabel);
        const seatsHTML = seatsLabel
            ? `\u003cspan class="party-row-seats" title="${escapeHtml(seatsTitle || seatsLabel)}">${escapeHtml(seatsLabel.toUpperCase())}\u003c/span>`
            : '';
        const descriptionHTML = description
            ? `\u003cdiv class="party-row-desc">${escapeHtml(description)}\u003c/div>`
            : '';
        const metaClass = showToggle ? 'party-row-meta' : 'party-row-meta party-row-meta--nested';
        return `
            \u003cdiv class="party-row-body">
                \u003cdiv class="party-row-media">${logoHTML}\u003c/div>
                \u003cdiv class="party-row-main">
                    \u003cspan class="party-row-name" title="${escapeHtml(name)}">${escapeHtml(name)}\u003c/span>
                    \u003cdiv class="${metaClass}">
                        ${metaExtraHTML}
                        ${seatsHTML}
                        ${buildPartyCaretSlotHTML(!!showToggle, toggleClass, caretClass, ariaLabel)}
                    \u003c/div>
                \u003c/div>
            \u003c/div>
            ${descriptionHTML}
        `;
    }

    function getWingSeatCount(wingOrName) {
        const wing = typeof wingOrName === 'string' ? getWingByName(wingOrName, { includeArchive: false }) : wingOrName;
        if (!wing) return 0;
        const names = new Set(getWingMemberNames(wing));
        if (!names.size || !Array.isArray(roster)) return 0;
        return roster.filter(m => {
            if (!m || !m.name || !names.has(m.name)) return false;
            if (m.rank === 'Chairperson' || m.rank === 'Overseer') return false;
            return true;
        }).length;
    }

    function isRosterWingSelectEnabled() {
        return Number(selectRosterWings) === 1;
    }

    function createWingRow(wing, parentParty) {
        const item = document.createElement('div');
        item.className = 'party-row party-wing-row';
        item.dataset.wing = wing.name || '';
        item.dataset.party = parentParty?.name || wing.party || '';
        const wingColor = getWingAccentColor(wing, parentParty) || parentParty?.color || '#888';
        item.style.setProperty('--party-color', safeColor(wingColor));

        const seatCount = getWingSeatCount(wing.name);
        const partySeats = Number(parentParty?.seats) || 0;
        if (seatCount > 0) item.dataset.wingSeats = String(seatCount);
        const seatsLabel = formatSeatPortion(seatCount, partySeats > 0 ? partySeats : null);
        const seatsTitle = seatPortionTitle(seatCount, partySeats > 0 ? partySeats : null, parentParty?.name || '');
        const seatsHTML = seatsLabel
            ? `\u003cspan class="party-row-seats" title="${escapeHtml(seatsTitle)}">${escapeHtml(seatsLabel)}\u003c/span>`
            : '';

        const logoSrc = escapeHtml(safeUrl(wing.logo || parentParty?.logo || defaultLogo, defaultLogo));
        const name = wing.name || '';
        const labelText = (wing.label != null ? String(wing.label) : '').trim();
        const labelHTML = labelText
            ? `\u003cdiv class="party-wing-row-bottom">${escapeHtml(labelText)}\u003c/div>`
            : '';

        item.innerHTML = `
            \u003cdiv class="party-row-body">
                \u003cdiv class="party-row-media">
                    \u003cimg class="party-row-logo" src="${logoSrc}" alt="${escapeHtml(name)}">
                \u003c/div>
                \u003cdiv class="party-row-main">
                    \u003cdiv class="party-wing-row-top">
                        \u003cspan class="party-row-name" title="${escapeHtml(name)}">${escapeHtml(name)}\u003c/span>
                        ${seatsHTML}
                    \u003c/div>
                    ${labelHTML}
                \u003c/div>
            \u003c/div>
        `;

        if (isRosterWingSelectEnabled() && name) {
            item.classList.add('party-wing-selectable');
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-pressed', 'false');
            item.title = `Highlight ${name} seats`;
            const activate = (e) => {
                e.stopPropagation();
                applySeatFocusForWing(name, parentParty?.name || wing.party || '');
            };
            item.addEventListener('click', activate);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activate(e);
                }
            });
        }

        return item;
    }

    function setPartyWingsDropdownOpen(wrapper, open) {
        if (!wrapper) return;
        wrapper.classList.toggle('open', open);
        const caret = wrapper.querySelector('.party-wing-caret');
        const toggleBtn = wrapper.querySelector('.party-wing-toggle');
        if (caret) caret.textContent = open ? '▲' : '▼';
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        syncExpandedWingsFromDom();
        applySeatFillForFocusState();
        applyCoalitionFocusStroke();
        updateLegendFocus(activeSeatFocusParties);
    }

    function createPartyBox(p, options = {}) {
        const nested = !!options.nestedInCoalition;
        const wings = getWingsForParty(p.name);
        const hasWings = wings.length > 0;

        const item = document.createElement('div');
        item.className = 'party-row party-roster-item';
        if (options.extraClass) item.classList.add(options.extraClass);
        if (p.name) item.dataset.party = p.name;
        item.style.setProperty('--party-color', safeColor(p.color));

        const logoHTML = `\u003cimg class="party-row-logo" src="${escapeHtml(safeUrl(p.logo || defaultLogo, defaultLogo))}" alt="${escapeHtml(p.name || '')}">`;
        const coalSeats = options.coalitionSeats;
        const coalName = options.coalitionName || '';
        const displaySeats = options.displaySeats ?? p.seats;
        const displayTotal = options.displayTotal ?? (
            nested && coalSeats != null && Number(coalSeats) > 0 ? coalSeats : null
        );
        item.innerHTML = buildPartyRowHTML({
            name: p.name || '',
            color: p.color || '#888',
            seats: displaySeats,
            ofTotal: displayTotal,
            ofLabel: nested ? coalName : '',
            logoHTML,
            description: p.description,
            showToggle: hasWings,
            toggleClass: 'party-wing-toggle',
            caretClass: 'party-wing-caret',
            ariaLabel: 'Toggle party wings'
        });

        if (!hasWings) return item;

        const wrapper = document.createElement('div');
        wrapper.className = 'party-with-wings';
        wrapper.dataset.party = p.name || '';

        const wingsEl = document.createElement('div');
        wingsEl.className = 'party-wings-list';
        wings.forEach(w => wingsEl.appendChild(createWingRow(w, p)));

        const toggleBtn = item.querySelector('.party-wing-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setPartyWingsDropdownOpen(wrapper, !wrapper.classList.contains('open'));
            });
        }

        wrapper.appendChild(item);
        wrapper.appendChild(wingsEl);
        return wrapper;
    }

    function buildCoalitionMediaHTML(coalition, members) {
        const overrideLogo = (coalition && coalition.logo != null)
            ? String(coalition.logo).trim()
            : '';
        const coalName = (coalition && coalition.name) || 'Coalition';

        if (overrideLogo) {
            return `\u003cimg class="coalition-logo-single party-row-logo" src="${escapeHtml(safeUrl(overrideLogo, defaultLogo))}" alt="${escapeHtml(coalName)}">`;
        }

        return buildCoalitionLogoStackHTML(members);
    }

    function buildCoalitionLogoStackHTML(members) {
        const maxVisible = 3;
        const list = Array.isArray(members) ? members : [];
        const visible = list.slice(0, maxVisible);
        const overflow = Math.max(0, list.length - visible.length);
        const count = Math.max(1, visible.length);

        const logos = visible.map(p =>
            `\u003cimg src="${escapeHtml(safeUrl(p.logo || defaultLogo, defaultLogo))}" alt="${escapeHtml(p.name)}">`
        ).join('');

        const moreHTML = overflow > 0
            ? `\u003cspan class="coalition-logo-more" title="${overflow} more party${overflow === 1 ? '' : 'ies'}">+${overflow}\u003c/span>`
            : '';

        const overflowClass = overflow > 0 ? ' has-overflow' : '';
        return `\u003cdiv class="coalition-logo-stack${overflowClass}" data-count="${count}" aria-hidden="true">${logos}${moreHTML}\u003c/div>`;
    }

    let expandedCoalitionPartyNames = new Set();
    let expandedCoalitionNames = new Set();
    let expandedWingPartyNames = new Set();

    function syncExpandedCoalitionsFromDom() {
        expandedCoalitionPartyNames = new Set();
        expandedCoalitionNames = new Set();
        if (!dom.partyBoxes) return;
        dom.partyBoxes.querySelectorAll('.party-coalition.open').forEach(wrapper => {
            const coalName = wrapper.dataset.coalition;
            if (coalName) expandedCoalitionNames.add(coalName);
            wrapper.querySelectorAll('.party-coalition-members .party-roster-item[data-party]').forEach(el => {
                const name = el.dataset.party;
                if (name) expandedCoalitionPartyNames.add(name);
            });
        });
    }

    function syncExpandedWingsFromDom() {
        expandedWingPartyNames = new Set();
        if (!dom.partyBoxes) return;
        dom.partyBoxes.querySelectorAll('.party-with-wings.open').forEach(wrapper => {
            const name = wrapper.dataset.party;
            if (name) expandedWingPartyNames.add(name);
        });
    }

    function getCoalitionsForFocusParties(focusParties) {
        const names = new Set();
        if (!focusParties || !focusParties.size) return names;
        getSeatCircles().forEach(c => {
            const party = c.getAttribute('data-party') || '';
            if (!party || !focusParties.has(party)) return;
            const coal = (c.getAttribute('data-coalition') || '').trim();
            if (coal) names.add(coal);
        });
        return names;
    }

    function shouldRevealSeatStyle(circle, wingCoalitions = null) {
        if (!circle) return false;
        const party = circle.getAttribute('data-party') || '';
        if (!party || party === 'Vacant') return false;
        const seatCoal = (circle.getAttribute('data-coalition') || '').trim();

        if (activeSeatFocusCoalition) {
            return seatCoal === activeSeatFocusCoalition;
        }
        // Wing focus inside a coalition: keep party colours on dimmed coalition
        // mates instead of falling back to the shared coalition fill.
        if (activeSeatFocusWing) {
            if (activeSeatFocusParties && activeSeatFocusParties.has(party)) return true;
            if (!seatCoal) return false;
            const coals = wingCoalitions || getCoalitionsForFocusParties(activeSeatFocusParties);
            return coals.has(seatCoal);
        }
        if (activeSeatFocusParties) {
            return activeSeatFocusParties.has(party);
        }
        return !!(seatCoal && expandedCoalitionNames.has(seatCoal));
    }

    function setCoalitionDropdownOpen(wrapper, open) {
        if (!wrapper) return;
        wrapper.classList.toggle('open', open);
        const caret = wrapper.querySelector('.party-coalition-caret');
        const toggleBtn = wrapper.querySelector('.party-coalition-toggle');
        if (caret) caret.textContent = open ? '▲' : '▼';
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        const header = wrapper.querySelector(':scope > .party-roster-coalition-header');
        if (header) header.setAttribute('aria-expanded', open ? 'true' : 'false');
        syncExpandedCoalitionsFromDom();
        syncExpandedWingsFromDom();
        applySeatFillForFocusState();
        applyCoalitionFocusStroke();
        updateLegendFocus(activeSeatFocusParties);
    }

    function createCoalitionBox(coalition, segments) {
        const wrapper = document.createElement('div');
        wrapper.className = 'party-coalition';
        wrapper.dataset.coalition = coalition.name || '';

        const totalSeats = getCoalitionSeatTotalFromSegments(segments);
        const coalColor = coalition.color || segments[0]?.party.color || '#888';
        const coalName = coalition.name || 'Coalition';

        const header = document.createElement('div');
        header.className = 'party-row party-roster-item party-roster-coalition-header';
        header.dataset.coalition = coalName;
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('aria-label', `Toggle ${coalName} composition`);
        header.style.setProperty('--party-color', safeColor(coalColor));
        header.innerHTML = buildPartyRowHTML({
            name: coalName,
            color: coalColor,
            seats: totalSeats,
            logoHTML: buildCoalitionMediaHTML(coalition, segments.map(segment => segment.party)),
            description: coalition.description,
            showToggle: true
        });

        const membersEl = document.createElement('div');
        membersEl.className = 'party-coalition-members';
        segments.forEach(segment => membersEl.appendChild(createPartyBox(segment.party, {
            nestedInCoalition: true,
            coalitionSeats: totalSeats,
            coalitionName: coalName,
            displaySeats: segment.seats,
            displayTotal: totalSeats,
        })));

        const toggleCoalition = (event) => {
            event.stopPropagation();
            const open = !wrapper.classList.contains('open');
            setCoalitionDropdownOpen(wrapper, open);
            header.setAttribute('aria-expanded', open ? 'true' : 'false');
            wrapper.classList.remove('party-roster-focus-open');
        };
        header.addEventListener('click', toggleCoalition);
        header.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggleCoalition(event);
        });

        wrapper.appendChild(header);
        wrapper.appendChild(membersEl);
        return wrapper;
    }

    function updatePartyRosterFocus(focusParties) {
        if (!dom.partyBoxes) return;
        if (!partyBoxesIndex) rebuildPartyBoxesIndex();
        const index = partyBoxesIndex;
        if (!index) return;

        const wingFocus = (typeof activeSeatFocusWing === 'string' && activeSeatFocusWing)
            ? activeSeatFocusWing
            : '';

        if (!focusParties) {
            index.focusables.forEach(el => {
                el.classList.remove('party-roster-focused', 'party-roster-dimmed');
                if (el.classList.contains('party-wing-row')) {
                    el.setAttribute('aria-pressed', 'false');
                }
            });
            index.coalitions.forEach(wrapper => {
                wrapper.classList.remove('party-roster-focused', 'party-roster-dimmed');
                if (wrapper.classList.contains('party-roster-focus-open')) {
                    setCoalitionDropdownOpen(wrapper, false);
                    wrapper.classList.remove('party-roster-focus-open');
                }
            });
            return;
        }

        if (wingFocus) {
            index.focusables.forEach(el => {
                el.classList.remove('party-roster-focused', 'party-roster-dimmed');
            });

            index.wingRows.forEach(el => {
                const isWing = (el.dataset.wing || '') === wingFocus;
                el.classList.toggle('party-roster-focused', isWing);
                el.classList.toggle('party-roster-dimmed', !isWing);
                el.setAttribute('aria-pressed', isWing ? 'true' : 'false');

                if (isWing) {
                    const wingWrap = el.closest('.party-with-wings');
                    if (wingWrap) {
                        wingWrap.classList.add('party-roster-focused');
                        wingWrap.classList.remove('party-roster-dimmed');
                        if (!wingWrap.classList.contains('open')) {
                            setPartyWingsDropdownOpen(wingWrap, true);
                        }
                        const partyRow = wingWrap.querySelector(':scope > .party-roster-item');
                        if (partyRow) {
                            partyRow.classList.add('party-roster-focused');
                            partyRow.classList.remove('party-roster-dimmed');
                        }
                        const coal = wingWrap.closest('.party-coalition');
                        if (coal) {
                            coal.classList.add('party-roster-focused');
                            coal.classList.remove('party-roster-dimmed');
                            if (!coal.classList.contains('open')) {
                                setCoalitionDropdownOpen(coal, true);
                                coal.classList.add('party-roster-focus-open');
                            }
                        }
                    }
                }
            });

            index.topLevel.forEach(el => {
                if (!el.classList.contains('party-roster-focused')) {
                    el.classList.add('party-roster-dimmed');
                }
            });
            return;
        }

        if (activeSeatFocusCoalition) {
            index.focusables.forEach(el => {
                el.classList.remove('party-roster-focused', 'party-roster-dimmed');
            });

            index.topLevel.forEach(el => {
                const coalitionWrapper = el.classList.contains('party-coalition') ? el : null;
                const isCoalition = !!(coalitionWrapper
                    && coalitionWrapper.dataset.coalition === activeSeatFocusCoalition);
                el.classList.toggle('party-roster-focused', isCoalition);
                el.classList.toggle('party-roster-dimmed', !isCoalition);
                if (isCoalition) {
                    if (!coalitionWrapper.classList.contains('open')) {
                        setCoalitionDropdownOpen(coalitionWrapper, true);
                        coalitionWrapper.classList.add('party-roster-focus-open');
                    }
                    coalitionWrapper.querySelectorAll('.party-roster-item, .party-with-wings').forEach(member => {
                        member.classList.add('party-roster-focused');
                        member.classList.remove('party-roster-dimmed');
                    });
                }
            });
            index.wingRows.forEach(el => {
                el.classList.remove('party-roster-focused');
                el.classList.add('party-roster-dimmed');
            });
            return;
        }

        index.wingRows.forEach(el => {
            el.classList.remove('party-roster-focused', 'party-roster-dimmed');
            el.setAttribute('aria-pressed', 'false');
        });

        index.topLevelPartyRows.forEach(el => {
            const partyName = el.dataset.party || '';
            const inFocus = !!(partyName && focusParties.has(partyName));
            el.classList.toggle('party-roster-focused', inFocus);
            el.classList.toggle('party-roster-dimmed', !inFocus);
            const wingWrap = el.closest('.party-with-wings');
            if (wingWrap && wingWrap.parentElement === dom.partyBoxes) {
                wingWrap.classList.toggle('party-roster-dimmed', !inFocus);
                wingWrap.classList.toggle('party-roster-focused', inFocus);
            }
        });

        index.topLevelCoalitions.forEach(wrapper => {
            const memberItems = wrapper.querySelectorAll('.party-coalition-members .party-roster-item:not(.party-wing-row)');
            const related = Array.from(memberItems).some(el => {
                const name = el.dataset.party || '';
                return name && focusParties.has(name);
            });

            wrapper.classList.toggle('party-roster-focused', related);
            wrapper.classList.toggle('party-roster-dimmed', !related);

            const header = wrapper.querySelector(':scope > .party-roster-coalition-header');
            if (header) {
                header.classList.toggle('party-roster-focused', related);
                header.classList.toggle('party-roster-dimmed', !related);
            }

            memberItems.forEach(el => {
                const name = el.dataset.party || '';
                const inFocus = !!(name && focusParties.has(name));
                el.classList.toggle('party-roster-focused', inFocus);
                el.classList.toggle('party-roster-dimmed', !inFocus);
                const wingWrap = el.closest('.party-with-wings');
                if (wingWrap && wrapper.contains(wingWrap)) {
                    wingWrap.classList.toggle('party-roster-dimmed', !inFocus);
                    wingWrap.classList.toggle('party-roster-focused', inFocus);
                }
            });

            if (related) {
                if (!wrapper.classList.contains('open')) {
                    setCoalitionDropdownOpen(wrapper, true);
                    wrapper.classList.add('party-roster-focus-open');
                }
            } else if (wrapper.classList.contains('party-roster-focus-open')) {
                setCoalitionDropdownOpen(wrapper, false);
                wrapper.classList.remove('party-roster-focus-open');
            }
        });
    }

    function renderPartyBoxes() {
        if (!dom.partyBoxes) return;
        dom.partyBoxes.innerHTML = '';

        getOrderedPoliticalBlocs().forEach(bloc => {
            if (bloc.kind === 'coalition') {
                dom.partyBoxes.appendChild(createCoalitionBox(bloc.coalition, bloc.segments));
                return;
            }
            const segment = bloc.segment;
            const fullMembers = getRosterMembersForParty(segment.partyName);
            const hasOverride = segment.members.length !== fullMembers.length
                || segment.seats !== (Number(segment.party.seats) || 0);
            dom.partyBoxes.appendChild(createPartyBox(segment.party, hasOverride ? {
                displaySeats: segment.seats,
                displayTotal: Number(segment.party.seats) || fullMembers.length,
            } : {}));
        });

        syncExpandedCoalitionsFromDom();
        syncExpandedWingsFromDom();
        rebuildPartyBoxesIndex();
        applySeatFillForFocusState();
        applyCoalitionFocusStroke();
        updateLegendFocus(activeSeatFocusParties);
        updatePartyRosterFocus(activeSeatFocusParties);
    }

    function renderSeatCount() {
        const assignedSeats = parties.reduce((sum, party) => sum + (Number(party.seats) || 0), 0);
        const resolvedTotalSeats = getResolvedTotalSeats();
        const displayValue = Number(showSeatCountSlash) === 1 && assignedSeats < resolvedTotalSeats
            ? `${assignedSeats}/${resolvedTotalSeats}`
            : String(resolvedTotalSeats);

        if (dom.districtSeatCount) {
            dom.districtSeatCount.textContent = displayValue;
        }

        if (dom.seatCountText) {
            dom.seatCountText.style.display = Number(showSeatCountText) === 1 ? '' : 'none';
            if (Number(showSeatCountText) === 1) dom.seatCountText.textContent = displayValue;
        }
    }

    function renderNextElectionCycle() {
        if (dom.nextElectionCycle) dom.nextElectionCycle.textContent = String(nextElectionCycle || '').trim() || 'TBA';
    }

    function formatAssemblySessionLabel() {
        const number = Number(sessionNumber);
        const raw = Number.isFinite(number) && number >= 0 ? String(Math.floor(number)) : '1';
        return `Session No. ${raw.padStart(2, '0')}`;
    }

    function renderSessionLabels() {
        const label = formatAssemblySessionLabel();
        [dom.sessionNumLabel, dom.sessionSubheadLabel, dom.sessionEyebrowLabel]
            .filter(Boolean)
            .forEach(element => { element.textContent = label; });
    }

    function renderAssemblyName() {
        const name = String(assemblyName || '').trim() || 'District Assembly';
        document.querySelectorAll('.assembly-name-label').forEach(element => {
            element.textContent = name;
        });
    }

    function renderTopPanelConfig() {
        const pendingPanel = $('#pending-bills-panel');
        if (pendingPanel) pendingPanel.hidden = !Number(showPendingBills);
        const quorumPanel = $('#assembly-quorum-panel');
        if (quorumPanel) quorumPanel.hidden = !Number(showAssemblyQuorum);
        if (dom.quorum) dom.quorum.textContent = Number.isFinite(Number(assemblyQuorum)) ? String(assemblyQuorum) : '0';
    }

    function buildMembersByParty() {
        const membersByParty = {};
        roster.forEach(member => {
            if (!member.party) return;
            if (member.rank === 'Chairperson' || member.rank === 'Overseer') return;
            if (!membersByParty[member.party]) membersByParty[member.party] = [];
            membersByParty[member.party].push(member);
        });
        return membersByParty;
    }

    function setSeatTooltip({ party, color, councillor, coalition, coalitionColor, wing, wingColor }) {
        if (!dom.seatTooltip) return;

        if (!party || party === 'Vacant') {
            resetTooltip();
            return;
        }

        const tipColor = safeColor(color);
        const tipCoalition = safeColor(coalitionColor, '');
        const tipWing = safeColor(wingColor, '');
        const hasName = !!(councillor && String(councillor).trim());

        let wingName = wing || '';
        let resolvedWingColor = tipWing;
        if (!wingName && councillor) {
            const w = getWingForCouncillor(councillor);
            if (w) {
                wingName = w.name || '';
                if (!resolvedWingColor) {
                    const accent = getWingAccentColor(w);
                    resolvedWingColor = safeColor(accent, '');
                }
            }
        }
        if (!resolvedWingColor && wingName) {
            const w = getWingByName(wingName);
            if (w) {
                const accent = getWingAccentColor(w);
                resolvedWingColor = safeColor(accent, '');
            }
        }

        const wingHTML = wingName
            ? `\u003cspan class="seat-tooltip-wing" title="${escapeHtml(wingName)}">${escapeHtml(wingName)}\u003c/span>`
            : '';
        const coalHTML = coalition
            ? `\u003cspan class="seat-tooltip-coalition" title="${escapeHtml(coalition)}">${escapeHtml(coalition)}\u003c/span>`
            : '';

        const styleBits = [`--tip-color:${tipColor}`];
        if (resolvedWingColor) styleBits.push(`--tip-wing:${resolvedWingColor}`);
        if (tipCoalition) styleBits.push(`--tip-coalition:${tipCoalition}`);

        dom.seatTooltip.innerHTML = `
            \u003cdiv class="seat-tooltip-card" style="${styleBits.join(';')}">
                \u003cdiv class="seat-tooltip-name${hasName ? '' : ' is-vacant'}" title="${escapeHtml(hasName ? councillor : 'Unassigned')}">
                    ${escapeHtml(hasName ? councillor : 'Unassigned')}
                \u003c/div>
                \u003cdiv class="seat-tooltip-meta">
                    \u003cspan class="seat-tooltip-party">
                        \u003cspan class="seat-tooltip-swatch" aria-hidden="true">\u003c/span>
                        \u003cspan class="seat-tooltip-party-label" title="${escapeHtml(party)}">${escapeHtml(party)}\u003c/span>
                    \u003c/span>
                    ${wingHTML}
                    ${coalHTML}
                \u003c/div>
            \u003c/div>
        `;
        dom.seatTooltip.classList.add('is-active');
    }

    const AssemblyArchDiagram = (() => {
        const TOTALS = [
            3, 15, 33, 61, 95, 138, 189, 247, 313, 388, 469, 559, 657, 762, 876, 997,
            1126, 1263, 1408, 1560, 1722, 1889, 2066, 2250, 2442, 2641, 2850, 3064,
            3289, 3519, 3759, 4005, 4261, 4522, 4794, 5071, 5358, 5652, 5953, 6263,
            6581, 6906, 7239, 7581, 7929, 8287, 8650, 9024, 9404, 9793, 10187, 10594,
            11003, 11425, 11850, 12288, 12729, 13183, 13638, 14109, 14580, 15066, 15553,
            16055, 16557, 17075, 17592, 18126, 18660, 19208, 19758, 20323, 20888, 21468,
            22050, 22645, 23243, 23853, 24467, 25094, 25723, 26364, 27011, 27667, 28329,
            29001, 29679, 30367, 31061
        ];

        function rowCountForSeats(totalSeats) {
            const n = Math.max(0, Math.floor(Number(totalSeats) || 0));
            if (n <= 0) return 0;
            const idx = TOTALS.findIndex(total => total >= n);
            return idx >= 0 ? idx + 1 : TOTALS.length;
        }

        function optimiseRows(rowCount, totalSeats) {
            let handledSpots = 0;
            for (let i = rowCount; i > 0; i--) {
                const magicNumber = 3 * rowCount + 4 * i - 2;
                const maximumSeatsInRow = Math.PI / (2 * Math.asin(2 / magicNumber));
                handledSpots += Math.trunc(maximumSeatsInRow);
                if (handledSpots >= totalSeats) {
                    return { discardRows: i - 1, diagramFullness: totalSeats / handledSpots };
                }
            }
            return { discardRows: 0, diagramFullness: 0 };
        }

        function appendSeatPositions(positions, seatsInRow, rowRadius, circleRadius) {
            const ratio = Math.sin(circleRadius / rowRadius);
            for (let i = 0; i < seatsInRow; i++) {
                const angle = seatsInRow === 1
                    ? Math.PI / 2
                    : i * (Math.PI - 2 * ratio) / (seatsInRow - 1) + ratio;
                positions.push({
                    angle,
                    x: rowRadius * Math.cos(angle) + 1.75,
                    y: rowRadius * Math.sin(angle),
                });
            }
            return positions;
        }

        function layout(options = {}) {
            const totalSeats = Math.max(0, Math.floor(Number(options.totalSeats) || 0));
            const viewBox = '0 0 360 185';
            if (totalSeats <= 0) return { positions: [], circleRadiusPx: 0, viewBox };

            const rowCount = rowCountForSeats(totalSeats);
            const circleRadius = 0.4 / rowCount;
            let discardRows = 0;
            let diagramFullness;
            if (options.denseRows) {
                const optimised = optimiseRows(rowCount, totalSeats);
                discardRows = optimised.discardRows;
                diagramFullness = optimised.diagramFullness;
            } else {
                diagramFullness = totalSeats / TOTALS[rowCount - 1];
            }

            let positions = [];
            for (let i = discardRows + 1; i < rowCount; i++) {
                const magicNumber = 3 * rowCount + 4 * i - 2;
                const maximumSeatsInRow = Math.PI / (2 * Math.asin(2 / magicNumber));
                const seatsInCurrentRow = Math.trunc(diagramFullness * maximumSeatsInRow);
                const currentRowRadius = magicNumber / (4 * rowCount);
                positions = appendSeatPositions(positions, seatsInCurrentRow, currentRowRadius, circleRadius);
            }

            const leftoverSeats = totalSeats - positions.length;
            if (leftoverSeats > 0) {
                const finalRowRadius = (7 * rowCount - 2) / (4 * rowCount);
                positions = appendSeatPositions(positions, leftoverSeats, finalRowRadius, circleRadius);
            }

            positions.sort((left, right) => right.angle - left.angle || right.x - left.x || right.y - left.y);
            positions = positions.slice(0, totalSeats);
            return {
                positions: positions.map(position => ({
                    cx: 5 + 100 * position.x,
                    cy: 5 + 100 * (1.75 - position.y),
                })),
                circleRadiusPx: circleRadius * 100,
                viewBox,
            };
        }

        return { layout };
    })();

    function setupSeatMap() {
        if (!dom.seatMap) return;
        invalidateSeatCirclesCache();

        let defs = dom.seatMap.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            dom.seatMap.insertBefore(defs, dom.seatMap.firstChild);
        }

        const seatsGroup = dom.seatMap.querySelector('#seats') || (() => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.id = 'seats';
            dom.seatMap.appendChild(group);
            return group;
        })();
        defs.innerHTML = '';
        seatsGroup.innerHTML = '';

        const layout = AssemblyArchDiagram.layout({
            totalSeats: getResolvedTotalSeats(),
            denseRows: Number(denseSeatRows) === 1,
        });
        dom.seatMap.setAttribute('viewBox', layout.viewBox);
        layout.positions.forEach(position => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', String(position.cx));
            circle.setAttribute('cy', String(position.cy));
            circle.setAttribute('r', String(Math.max(1.5, layout.circleRadiusPx || 0)));
            seatsGroup.appendChild(circle);
        });

        const circles = Array.from(dom.seatMap.querySelectorAll('circle'));
        const orderedParties = getDisplayOrderedParties();
        let seatIdx = 0;

        const ensureLinearGrad = (gid, color) => {
            if (defs.querySelector(`#${gid}`)) return;
            const safe = safeColor(color);
            const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            grad.id = gid;
            grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
            grad.setAttribute('x2', '0%'); grad.setAttribute('y2', '100%');
            const stop0 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop0.setAttribute('offset', '0%');
            stop0.setAttribute('stop-color', safe);
            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop1.setAttribute('offset', '100%');
            stop1.setAttribute('stop-color', safe);
            stop1.setAttribute('stop-opacity', '0.65');
            grad.appendChild(stop0);
            grad.appendChild(stop1);
            defs.appendChild(grad);
        };

        orderedParties.forEach(segment => {
            const party = segment.party;
            const seatCount = Number(segment.seats);
            if (!Number.isFinite(seatCount) || seatCount <= 0) return;

            const coalition = segment.coalition;
            const partyColor = party.color || '#888';
            const seatColor = coalition?.color || getSeatColorForParty(party) || partyColor;
            const safeParty = party.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

            const partyGid = `grad-${safeParty}`;
            ensureLinearGrad(partyGid, partyColor);

            let defaultGid = partyGid;
            if (coalition && coalition.color) {
                const coalKey = (coalition.name || 'group').replace(/[^a-z0-9]/gi, '-').toLowerCase();
                defaultGid = `grad-coal-${coalKey}`;
                ensureLinearGrad(defaultGid, seatColor);
            }

            const members = segment.members || [];
            const seatStroke = coalition
                ? (coalition.stroke || coalition.color || '')
                : getSeatStrokeForParty(party);
            const fillDefault = `url(#${defaultGid})`;
            const fillReveal = `url(#${partyGid})`;

            for (let i = 0; i < seatCount && seatIdx < circles.length; i++, seatIdx++) {
                const c = circles[seatIdx];
                const member = members[i];
                const wing = member && member.name ? getWingForCouncillor(member.name) : null;
                const wingValid = wing && (!member.party || !wing.party || member.party === wing.party);
                const wingAccent = wingValid ? getWingAccentColor(wing, party) : '';

                let fillWingReveal = '';
                if (wingValid && wingAccent) {
                    const wingKey = (wing.name || 'wing').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
                    const wingGid = `grad-wing-${safeParty}-${wingKey}`;
                    ensureLinearGrad(wingGid, wingAccent);
                    fillWingReveal = `url(#${wingGid})`;
                }

                c.setAttribute('fill', fillDefault);
                c.setAttribute('data-fill-default', fillDefault);
                c.setAttribute('data-fill-reveal', fillReveal);
                c.setAttribute('data-fill-wing-reveal', fillWingReveal);
                c.setAttribute('data-party', party.name);
                c.setAttribute('data-membership-kind', segment.membershipKind || 'native');
                c.setAttribute('data-party-color', partyColor);
                c.setAttribute('data-color', seatColor);
                c.setAttribute('data-councillor', member ? member.name : '');
                c.setAttribute('data-coalition', coalition ? coalition.name : '');
                c.setAttribute('data-coalition-color', coalition && coalition.color ? coalition.color : '');
                c.setAttribute('data-coalition-stroke', seatStroke);
                c.setAttribute('data-wing', wingValid && wing.name ? wing.name : '');
                c.setAttribute('data-wing-color', wingAccent);
                c.setAttribute('stroke', 'none');
                c.setAttribute('stroke-width', '0');
            }
        });

        while (seatIdx < circles.length) {
            const c = circles[seatIdx++];
            c.setAttribute('fill', vacantColor);
            c.setAttribute('stroke', vacantStroke);
            c.setAttribute('stroke-width', '1');
            c.setAttribute('data-party', 'Vacant');
            c.setAttribute('data-color', '#888');
            c.setAttribute('data-councillor', '');
            c.setAttribute('data-coalition', '');
            c.setAttribute('data-coalition-color', '');
            c.setAttribute('data-coalition-stroke', '');
            c.setAttribute('data-fill-wing-reveal', '');
            c.setAttribute('data-wing', '');
            c.setAttribute('data-wing-color', '');
            c.setAttribute('opacity', vacantOpacity);
        }

        cachedSeatCircles = circles;
        renderSeatCount();
        clearSeatFocus();

        if (dom.seatTooltip) {
            dom.seatTooltip.style.pointerEvents = 'none';
            dom.seatTooltip.style.userSelect = 'none';
        }

        if (dom.seatMap && !dom.seatMap.dataset.seatClicksBound) {
            dom.seatMap.addEventListener('click', onSeatMapClick);
            dom.seatMap.dataset.seatClicksBound = '1';
        }
    }

    let activeSeatFocusParties = null;
    let activeSeatFocusWing = null;
    let activeSeatFocusCoalition = null;
    let cachedSeatCircles = null;

    function invalidateSeatCirclesCache() {
        cachedSeatCircles = null;
    }

    function getSeatCircles() {
        if (cachedSeatCircles) return cachedSeatCircles;
        cachedSeatCircles = dom.seatMap
            ? Array.from(dom.seatMap.querySelectorAll('#seats circle, circle'))
            : [];
        return cachedSeatCircles;
    }

    function onSeatMapClick(e) {
        const c = e.target.closest?.('circle') || (e.target.tagName === 'circle' ? e.target : null);
        if (!c || !dom.seatMap?.contains(c)) return;
        e.stopPropagation();

        if (activeTooltipCircle === c) {
            resetTooltip();
            clearSeatFocus();
            return;
        }

        const party = c.getAttribute('data-party') || '';
        if (!party || party === 'Vacant') {
            resetTooltip();
            clearSeatFocus();
            return;
        }

        setSeatTooltip({
            party,
            color: c.getAttribute('data-party-color') || c.getAttribute('data-color'),
            councillor: c.getAttribute('data-councillor') || '',
            coalition: c.getAttribute('data-coalition') || '',
            coalitionColor: c.getAttribute('data-coalition-color') || '',
            wing: c.getAttribute('data-wing') || '',
            wingColor: c.getAttribute('data-wing-color') || ''
        });
        activeTooltipCircle = c;
        applySeatFocusForParty(party, c.getAttribute('data-coalition') || '');
    }

    function applySeatFillForFocusState() {
        const wingCoalitions = activeSeatFocusWing
            ? getCoalitionsForFocusParties(activeSeatFocusParties)
            : null;
        getSeatCircles().forEach(c => {
            const party = c.getAttribute('data-party') || '';
            if (!party || party === 'Vacant') return;
            const reveal = shouldRevealSeatStyle(c, wingCoalitions);
            const wingOpen = expandedWingPartyNames.has(party);
            const seatWing = (c.getAttribute('data-wing') || '').trim();
            const hasWing = !!seatWing;
            const wingFill = (c.getAttribute('data-fill-wing-reveal') || '').trim();
            const wingSelectTint = !!(activeSeatFocusWing && seatWing === activeSeatFocusWing && wingFill);
            const mapWingTint = Number(useWingSeatColors) === 1 && wingOpen && hasWing && !!wingFill;
            const showWingTint = wingSelectTint || mapWingTint;

            let fill = c.getAttribute('data-fill-default');
            if (showWingTint) {
                fill = wingFill;
            } else if (reveal) {
                fill = c.getAttribute('data-fill-reveal') || fill;
            }
            if (fill) c.setAttribute('fill', fill);
        });
    }

    function clearSeatFocus() {
        activeSeatFocusParties = null;
        activeSeatFocusWing = null;
        activeSeatFocusCoalition = null;
        getSeatCircles().forEach(c => {
            c.classList.remove('seat-focused', 'seat-dimmed', 'seat-selected');
        });
        applySeatFillForFocusState();
        applyCoalitionFocusStroke();
        updateLegendFocus(null);
        updatePartyRosterFocus(null);
    }

    function applySeatFocusForWing(wingName, partyName) {
        if (!isRosterWingSelectEnabled()) return;
        const wing = (wingName || '').trim();
        if (!wing) {
            clearSeatFocus();
            return;
        }

        if (
            activeSeatFocusWing === wing &&
            activeSeatFocusParties &&
            (!partyName || activeSeatFocusParties.has(partyName))
        ) {
            clearSeatFocus();
            resetTooltip();
            return;
        }

        const focusParties = new Set();
        if (partyName) {
            focusParties.add(partyName);
        } else {
            getSeatCircles().forEach(c => {
                if ((c.getAttribute('data-wing') || '').trim() === wing) {
                    const p = c.getAttribute('data-party') || '';
                    if (p && p !== 'Vacant') focusParties.add(p);
                }
            });
        }

        activeSeatFocusParties = focusParties.size ? focusParties : new Set();
        activeSeatFocusWing = wing;
        activeSeatFocusCoalition = null;

        const wingSeats = getSeatCircles().filter(c =>
            (c.getAttribute('data-wing') || '').trim() === wing
        );
        const primarySeat = wingSeats.find(c =>
            (c.getAttribute('data-councillor') || '').trim()
        ) || wingSeats[0] || null;

        getSeatCircles().forEach(c => {
            const party = c.getAttribute('data-party') || '';
            const seatWing = (c.getAttribute('data-wing') || '').trim();
            const isFocus = !!(party && party !== 'Vacant' && focusParties.has(party));
            const isSelected = seatWing === wing;
            c.classList.toggle('seat-focused', isFocus);
            c.classList.toggle('seat-dimmed', !isFocus);
            c.classList.toggle('seat-selected', isSelected);
        });

        if (primarySeat) {
            activeTooltipCircle = primarySeat;
            setSeatTooltip({
                party: primarySeat.getAttribute('data-party') || partyName || '',
                color: primarySeat.getAttribute('data-party-color')
                    || primarySeat.getAttribute('data-color') || '',
                councillor: primarySeat.getAttribute('data-councillor') || '',
                coalition: primarySeat.getAttribute('data-coalition') || '',
                coalitionColor: primarySeat.getAttribute('data-coalition-color') || '',
                wing: primarySeat.getAttribute('data-wing') || wing,
                wingColor: primarySeat.getAttribute('data-wing-color') || ''
            });
        } else {
            resetTooltip();
            activeTooltipCircle = null;
        }

        applySeatFillForFocusState();
        applyCoalitionFocusStroke();
        updateLegendFocus(activeSeatFocusParties);
        updatePartyRosterFocus(activeSeatFocusParties);
    }

    function applySeatFocusForParty(partyName, coalitionName = '') {
        if (!partyName || partyName === 'Vacant') {
            clearSeatFocus();
            return;
        }

        const coalName = String(coalitionName || '').trim();
        const focusParties = new Set();

        if (coalName) {
            getSeatCircles().forEach(c => {
                if ((c.getAttribute('data-coalition') || '') === coalName) {
                    const party = c.getAttribute('data-party') || '';
                    if (party && party !== 'Vacant') focusParties.add(party);
                }
            });
            const coalition = coalitions.find(c => c.name === coalName);
            if (coalition && Array.isArray(coalition.parties)) {
                coalition.parties.forEach(entry => {
                    if (typeof entry === 'string' && entry.trim()) focusParties.add(entry.trim());
                });
            }
        } else {
            focusParties.add(partyName);
        }

        activeSeatFocusParties = focusParties;
        activeSeatFocusWing = null;
        activeSeatFocusCoalition = coalName || null;

        getSeatCircles().forEach(c => {
            const party = c.getAttribute('data-party') || '';
            const seatCoal = c.getAttribute('data-coalition') || '';
            const isFocus = coalName
                ? seatCoal === coalName
                : !!(party && party !== 'Vacant' && focusParties.has(party));
            const isSelected = isFocus && activeTooltipCircle === c;
            c.classList.toggle('seat-focused', isFocus);
            c.classList.toggle('seat-dimmed', !isFocus);
            c.classList.toggle('seat-selected', isSelected);
        });
        applySeatFillForFocusState();
        applyCoalitionFocusStroke();
        updateLegendFocus(focusParties);
        updatePartyRosterFocus(focusParties);
    }

    function resetTooltip() {
        if (!dom.seatTooltip) return;
        dom.seatTooltip.classList.remove('is-active');
        dom.seatTooltip.innerHTML = '\u003cdiv class="seat-tooltip-idle">\u003c/div>';
        dom.seatTooltip.style.color = '';
        activeTooltipCircle = null;
    }

    //  DECREE EXPIRY FUNCTION

    function formatDuration(ms, isPast) {
        const totalMins = Math.floor(ms / 60000);
        const totalHours = Math.floor(totalMins / 60);
        const totalDays = Math.floor(totalHours / 24);
        const totalMonths = Math.floor(totalDays / 30);

        if (!isPast) {
            if (ms < 3_600_000) return '< 1 hour';
            if (totalDays === 0) {
                const remMins = totalMins - totalHours * 60;
                return remMins > 0 ? `${totalHours}h ${remMins}m` : `${totalHours}h`;
            }
            if (totalMonths >= 1) {
                const remDays = totalDays - totalMonths * 30;
                return remDays > 0
                    ? `${totalMonths} month${totalMonths > 1 ? 's' : ''}, ${remDays} day${remDays !== 1 ? 's' : ''}`
                    : `${totalMonths} month${totalMonths > 1 ? 's' : ''}`;
            }
            return `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
        } else {
            if (totalDays === 0) {
                if (totalHours >= 1) {
                    const remMins = totalMins - totalHours * 60;
                    return remMins > 0 ? `${totalHours}h ${remMins}m` : `${totalHours}h`;
                }
                return totalMins >= 1 ? `${totalMins}m` : '< 1 min';
            }
            if (totalMonths >= 1) {
                const remDays = totalDays - totalMonths * 30;
                return remDays > 0
                    ? `${totalMonths} month${totalMonths > 1 ? 's' : ''}, ${remDays} day${remDays !== 1 ? 's' : ''}`
                    : `${totalMonths} month${totalMonths > 1 ? 's' : ''}`;
            }
            return `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
        }
    }

    function getDecreeExpiry(d) {
        const rawStatus = (d.status ?? '').toString().trim();
        const statusKey = rawStatus.toLowerCase();

        if (EXPIRY_OVERRIDES.includes(statusKey)) {
            return { resolvedStatus: rawStatus || 'N/A', labelSuffix: '' };
        }
        if (!d.expiresAt) return { resolvedStatus: rawStatus || 'N/A', labelSuffix: '' };

        const expiresAt = new Date(d.expiresAt);
        if (isNaN(expiresAt)) return { resolvedStatus: rawStatus || 'N/A', labelSuffix: '' };

        const diff = expiresAt - PAGE_LOAD_TIME;

        if (diff <= 0) {
            const agoStr = formatDuration(PAGE_LOAD_TIME - expiresAt, true);
            return {
                resolvedStatus: 'expired',
                labelSuffix: ` · Expired ${agoStr} ago`,
            };
        }

        const countStr = formatDuration(diff, false);
        return {
            resolvedStatus: rawStatus || 'active',
            labelSuffix: ` · Expires in ${countStr}`,
        };
    }

    function renderDecrees() {
        if (!dom.decreesContent) return;
        dom.decreesContent.innerHTML = '';

        const collapseHost = dom.decreesContent.closest('.wn-container') || document.documentElement;
        const COLLAPSE_HEIGHT = parseFloat(getComputedStyle(collapseHost).getPropertyValue('--decree-collapse-height')) || 100;

        const TOGGLE_SLACK = 25;

        const createDecreeCard = (d) => {
            const { resolvedStatus, labelSuffix } = getDecreeExpiry(d);
            const card = document.createElement('div');
            const overrideClasses = getClassOverrideList(d.classOverride);
            card.className = ['ly-tier-banner', ...overrideClasses].join(' ');
            card.style.cssText = 'margin-bottom: 20px; position: relative; overflow: hidden;';

            const issuedByString = [d.role, d.name].filter(Boolean).join(' ') || 'Overwatch';
            const isPinned = hasPinnedClass(d.classOverride);
            const pinnedBadge = isPinned ? '\u003cspan class="status status-pinned">Pinned\u003c/span>' : '';
            const description = d.description != null ? String(d.description).trim() : '';

            card.innerHTML = `
                \u003cdiv class="ly-tier-banner-header">
                    \u003cdiv style="flex:1;">
                        \u003cdiv class="ly-tier-label">${escapeHtml(d.number || 'N/A')} · ${escapeHtml(d.category || 'N/A')} · ${escapeHtml(formatDisplayDate(d.date || 'N/A'))}${escapeHtml(labelSuffix)}\u003c/div>
                        \u003cdiv class="ly-tier-title">${escapeHtml(d.title || 'Untitled Decree')}\u003c/div>
                    \u003c/div>
                    \u003cdiv style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                        \u003cspan class="status status-${statusSlug(resolvedStatus)}">${escapeHtml(resolvedStatus)}\u003c/span>
                        ${pinnedBadge}
                    \u003c/div>
                \u003c/div>
                \u003cdiv class="ly-tier-banner-body">
                    \u003cdiv style="margin-bottom:10px;">
                        \u003cspan class="wn-eyebrow">Issued By\u003c/span>
                        \u003cp style="margin:4px 0 0;font-family:'Share Tech Mono',monospace;font-size:12px;color:rgba(255,255,255,0.55);">${escapeHtml(issuedByString)}\u003c/p>
                    \u003c/div>
                    \u003chr style="margin:8px 0;">
                    \u003cdiv class="decree-desc-block">
                        \u003cdiv class="decree-desc-wrapper">
                            \u003cdiv class="decree-desc-content${description ? '' : ' is-empty'}">${description ? escapeHtml(description) : 'No description provided.'}\u003c/div>
                        \u003c/div>
                    \u003c/div>
                    \u003cspan class="decree-stamp">${escapeHtml(d.category || '')}\u003c/span>
                \u003c/div>
            `;

            if (!description) return { card, measure: null };

            const block = card.querySelector('.decree-desc-block');
            const wrapper = card.querySelector('.decree-desc-wrapper');
            const content = card.querySelector('.decree-desc-content');
            if (!block || !wrapper || !content) return { card, measure: null };

            const enableCollapse = () => {
                wrapper.classList.add('collapsed');
                wrapper.style.maxHeight = `${COLLAPSE_HEIGHT}px`;

                const fade = document.createElement('div');
                fade.className = 'decree-fade-overlay';
                wrapper.appendChild(fade);

                const toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'decree-toggle-btn';
                toggleBtn.textContent = 'Expand';
                block.appendChild(toggleBtn);

                let isExpanded = false;

                const expand = () => {
                    isExpanded = true;
                    wrapper.classList.remove('collapsed');
                    wrapper.style.maxHeight = `${content.scrollHeight}px`;
                    toggleBtn.textContent = 'Minimize';
                };

                const collapse = () => {
                    isExpanded = false;
                    if (!wrapper.style.maxHeight || wrapper.style.maxHeight === 'none') {
                        wrapper.style.maxHeight = `${wrapper.scrollHeight}px`;
                        void wrapper.offsetHeight;
                    }
                    wrapper.classList.add('collapsed');
                    wrapper.style.maxHeight = `${COLLAPSE_HEIGHT}px`;
                    toggleBtn.textContent = 'Expand';
                };

                toggleBtn.addEventListener('click', () => {
                    if (isExpanded) collapse();
                    else expand();
                });

                wrapper.addEventListener('transitionend', (e) => {
                    if (e.propertyName !== 'max-height') return;
                    if (isExpanded) wrapper.style.maxHeight = 'none';
                });
            };

            return {
                card,
                measure: { content, enableCollapse },
            };
        };

        const pendingMeasures = [];
        const appendDecreeCard = (d, parent = dom.decreesContent, styleMargin = '') => {
            const { card, measure } = createDecreeCard(d);
            if (styleMargin) card.style.marginBottom = styleMargin;
            parent.appendChild(card);
            if (measure) pendingMeasures.push(measure);
        };

        const pinnedDecrees = decrees.filter(d => hasPinnedClass(d.classOverride));
        const regularDecrees = decrees.filter(d => !hasPinnedClass(d.classOverride));

        if (!decrees.length) {
            dom.decreesContent.innerHTML = emptyStateHTML('No decrees on record.');
            return;
        }

        if (pinnedDecrees.length) {
            const section = document.createElement('section');
            section.style.marginBottom = '24px';

            const title = document.createElement('div');
            title.className = 'dynamic-section-title';
            title.textContent = 'Pinned Decrees';
            title.style.color = '#c52237';
            section.appendChild(title);

            pinnedDecrees.forEach(d => appendDecreeCard(d, section, '16px'));
            dom.decreesContent.appendChild(section);
        }

        const sessionGroups = {};
        regularDecrees.forEach(d => {
            const session = getSessionPrefix(d.number);
            if (!sessionGroups[session]) sessionGroups[session] = [];
            sessionGroups[session].push(d);
        });

        Object.keys(sessionGroups).forEach(session => {
            sessionGroups[session].sort((a, b) => {
                const dateA = parseNaturalDate(a.date);
                const dateB = parseNaturalDate(b.date);
                if (dateA > dateB) return -1;
                if (dateA < dateB) return 1;
                return getNumberSuffix(b.number) - getNumberSuffix(a.number);
            });
        });

        const sessionOrder = Object.keys(sessionGroups).sort((sessionA, sessionB) => {
            const numA = parseInt(sessionA, 10);
            const numB = parseInt(sessionB, 10);

            const isANan = isNaN(numA);
            const isBNan = isNaN(numB);

            if (!isANan && !isBNan) {
                return numB - numA;
            }

            if (!isANan && isBNan) return -1;
            if (isANan && !isBNan) return 1;

            return sessionA.localeCompare(sessionB);
        });

        sessionOrder.forEach((session) => {
            const sessionHeader = document.createElement('div');
            sessionHeader.className = 'dynamic-section-title';
            sessionHeader.textContent = formatSessionLabel(session);
            sessionHeader.style.color = 'var(--wn-accent)';
            dom.decreesContent.appendChild(sessionHeader);

            sessionGroups[session].forEach(d => appendDecreeCard(d));
        });

        requestAnimationFrame(() => {
            pendingMeasures.forEach(({ content, enableCollapse }) => {
                const height = content.scrollHeight;
                if (height > COLLAPSE_HEIGHT + TOGGLE_SLACK) enableCollapse();
            });
        });
    }

    function renderCommittees() {
        if (!dom.committeesContent) return;
        dom.committeesContent.innerHTML = '';

        const categories = [...new Set(committees.map(c => c.category || 'Committee'))];

        if (!committees.length) {
            dom.committeesContent.innerHTML = emptyStateHTML('No committees on record.');
            return;
        }

        categories.forEach(category => {
            const section = document.createElement('section');
            section.style.marginBottom = '24px';

            const categoryCommittees = [...committees.filter(c => (c.category || 'Committee') === category)]
                .sort((a, b) => Number(hasPinnedClass(b.classOverride)) - Number(hasPinnedClass(a.classOverride)));
            const sectionColor = getCategoryColor(category, committeeCategoryColors);

            const title = document.createElement('div');
            title.className = 'dynamic-section-title';
            title.textContent = formatCommitteeCategorySectionTitle(category);
            if (sectionColor) {
                title.style.color = sectionColor;
            }
            section.appendChild(title);

            categoryCommittees.forEach(committee => {
                const card = document.createElement('div');
                const overrideClasses = getClassOverrideList(committee.classOverride);
                card.className = ['ly-tier-banner', ...overrideClasses].join(' ');
                card.style.marginBottom = '16px';

                const membersMarkup = (committee.members || [])
                    .map(member => `\u003cspan class="member-pill ${member.chair ? 'chair' : ''}">${escapeHtml(member.name || 'Name')}\u003c/span>`)
                    .join('');
                const isPinned = hasPinnedClass(committee.classOverride);
                const pinnedBadge = isPinned ? '\u003cspan class="status status-pinned">Pinned\u003c/span>' : '';

                card.innerHTML = `
                    \u003cdiv class="ly-tier-banner-header">
                        \u003cdiv style="flex:1;">
                            \u003cdiv class="ly-tier-label">${escapeHtml(committee.category || 'Committee')} · ${committee.date ?
                        `Est. ${escapeHtml(formatDisplayDate(committee.date))}` : '\u003cspan style="opacity: 0.6;">Permanent\u003c/span>'}\u003c/div>
                            \u003cdiv class="ly-tier-title">${escapeHtml(committee.title || 'Untitled Committee')}\u003c/div>
                        \u003c/div>
                        \u003cdiv style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                            \u003cspan class="status status-${statusSlug(committee.status || 'inactive')}">${escapeHtml(committee.status || 'inactive')}\u003c/span>
                            ${pinnedBadge}
                        \u003c/div>
                    \u003c/div>
                    \u003cdiv class="ly-tier-banner-body">
                        \u003cp style="margin-bottom:14px;">${escapeHtml(committee.description || 'Description')}\u003c/p>
                        \u003cdiv style="border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;">
                            \u003cspan class="wn-eyebrow" style="display:block;margin-bottom:8px;">Members\u003c/span>
                            \u003cdiv>${membersMarkup || '\u003cspan class="member-pill">No members listed\u003c/span>'}\u003c/div>
                        \u003c/div>
                    \u003c/div>
                `;

                section.appendChild(card);
            });

            dom.committeesContent.appendChild(section);
        });

        renderCommitteeCount();
    }

    //  LEGISLATION — FILTER / SORT

    function preprocessBills() {
        bills.forEach((b, index) => {
            b._uid = `bill-${index}`;
            b.number = b.number != null ? String(b.number).trim() : '';
            b.title = b.title != null ? String(b.title).trim() : '';
            b.type = b.type != null ? String(b.type).trim() : '';
            b.status = b.status != null ? String(b.status).trim() : '';
            b.introduced = b.introduced != null ? String(b.introduced).trim() : '';
            b.modified = b.modified != null ? String(b.modified).trim() : '';
            b.description = b.description != null ? String(b.description).trim() : '';
            b.stage = b.stage != null ? String(b.stage).trim() : '';
            b.link = b.link != null ? String(b.link).trim() : '';
            b.sponsors = normalizeSponsorNames(b.sponsors != null ? b.sponsors : b.sponsor);
            b.parties = (Array.isArray(b.parties) ? b.parties : b.party ? [b.party] : [])
                .map(name => typeof name === 'string' ? name.trim() : '')
                .filter(Boolean);
            b.tags = (Array.isArray(b.tags) ? b.tags : [])
                .map(tag => typeof tag === 'string' ? tag.trim() : '')
                .filter(Boolean);
            b.amendments = Array.isArray(b.amendments)
                ? b.amendments.filter(Boolean).map(amendment => {
                    if (!amendment || typeof amendment !== 'object') return amendment;
                    amendment.id = amendment.id != null ? String(amendment.id).trim() : '';
                    amendment.title = amendment.title != null ? String(amendment.title).trim() : '';
                    amendment.text = amendment.text != null ? String(amendment.text).trim() : '';
                    amendment.status = amendment.status != null ? String(amendment.status).trim() : '';
                    amendment.introduced = amendment.introduced != null ? String(amendment.introduced).trim() : '';
                    amendment.modified = amendment.modified != null ? String(amendment.modified).trim() : '';
                    amendment.link = amendment.link != null ? String(amendment.link).trim() : '';
                    amendment.sponsors = normalizeSponsorNames(
                        amendment.sponsors != null ? amendment.sponsors : amendment.sponsor
                    );
                    return amendment;
                })
                : [];
            if (b.votes && typeof b.votes === 'object') {
                b.votes.aye = Array.isArray(b.votes.aye) ? b.votes.aye : [];
                b.votes.abstain = Array.isArray(b.votes.abstain) ? b.votes.abstain : [];
                b.votes.nay = Array.isArray(b.votes.nay) ? b.votes.nay : [];
            }
            b._sortNumber = getNumberSuffix(b.number);
            b._sortIntroduced = parseNaturalDate(b.introduced);
            b._sortModified = parseNaturalDate(b.modified);
            b._hasSortNumber = /-\d+$/.test(b.number);
        });
    }

    function clearLegislationFilters() {
        selectedTags.length = 0;
        selectedStatuses.length = 0;
        selectedTypes.length = 0;
        lastFilterKey = null;
        cachedFilteredBills = null;
        buildFilterClouds();
        renderBills();
    }

    function getFilteredBills() {
        const key = JSON.stringify({
            tags: [...selectedTags].sort(),
            tagMatchMode,
            statuses: [...selectedStatuses].sort(),
            types: [...selectedTypes].sort(),
        });

        if (key === lastFilterKey) return cachedFilteredBills;
        lastFilterKey = key;

        cachedFilteredBills = bills.filter(b => {
            const tagOk = !selectedTags.length || (tagMatchMode === 'any'
                ? selectedTags.some(t => b.tags?.includes(t))
                : selectedTags.every(t => b.tags?.includes(t)));
            const statusOk = !selectedStatuses.length || selectedStatuses.includes(b.status);
            const typeOk = !selectedTypes.length || selectedTypes.includes(b.type);
            return tagOk && statusOk && typeOk;
        });

        return cachedFilteredBills;
    }

    function toggleControlDrawer() {
        if (!dom.controlDrawer || !dom.drawerCaret) return;
        const open = dom.controlDrawer.classList.toggle('open');
        dom.drawerCaret.textContent = open ? '▲' : '▼';
        if (dom.legislationDrawerToggle) {
            dom.legislationDrawerToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    }

    function toggleRoster() {
        if (!dom.rosterPanel || !dom.rosterCaret) return;
        const open = dom.rosterPanel.classList.toggle('open');
        dom.rosterCaret.textContent = open ? '▲' : '▼';
        if (dom.rosterToggleBtn) {
            dom.rosterToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    }

    function updateLegislationControlsVisibility() {
        const controls = $('#legislation-controls');
        if (!controls) return;
        const hasBills = Array.isArray(bills) && bills.length > 0;
        controls.style.display = hasBills ? '' : 'none';
        if (!hasBills && dom.controlDrawer) {
            dom.controlDrawer.classList.remove('open');
            if (dom.drawerCaret) dom.drawerCaret.textContent = '▼';
        }
    }

    function handleGroupingToggle(mode) {
        activeViewMode = (activeViewMode === mode) ? "none" : mode;
        $$('#grouping-mode-container .mode-toggle-btn').forEach(b => b.classList.remove('active'));
        if (activeViewMode !== "none") {
            const btn = $(`#mode-${activeViewMode}`);
            if (btn) btn.classList.add('active');
        }
        renderBills();
    }

    function syncTagMatchToggleUI() {
        ['all', 'any'].forEach(matchMode => {
            const button = $(`#tag-match-${matchMode}`);
            if (!button) return;
            const isActive = tagMatchMode === matchMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function handleTagMatchToggle(mode) {
        // Always keep exactly one mode selected (not toggleable off).
        tagMatchMode = mode === 'any' ? 'any' : 'all';
        syncTagMatchToggleUI();
        lastFilterKey = '';
        renderBills();
    }

    function handleSortToggle(field) {
        if (currentSortField === field) {
            if (field === 'type' || field === 'status') {
                currentSortField = null; isAscending = true;
            } else {
                if (isAscending) { isAscending = false; }
                else { currentSortField = null; isAscending = true; }
            }
        } else {
            currentSortField = field; isAscending = true;
        }
        renderBills();
    }

    function updateSortUIIndicators() {
        $$('.sort-link').forEach(link => {
            link.classList.remove('active');
            const d = link.querySelector('.dir');
            if (d) d.textContent = '';
        });
        if (currentSortField) {
            const lnk = $(`#sort-${currentSortField}`);
            if (lnk) {
                lnk.classList.add('active');
                const d = lnk.querySelector('.dir');
                if (d && ['number', 'introduced', 'modified'].includes(currentSortField))
                    d.textContent = isAscending ? ' ▲' : ' ▼';
            }
        }
    }

    function buildFilterClouds() {
        const tagSet = new Set(), statusSet = new Set(), typeSet = new Set();
        bills.forEach(b => {
            if (b.status) statusSet.add(b.status);
            if (b.type) typeSet.add(b.type);
            if (b.tags) b.tags.forEach(t => { if (t?.trim() && t.toUpperCase() !== 'N/A') tagSet.add(t.trim()); });
        });

        generateCloud(dom.statusCloud, [...statusSet].sort(), selectedStatuses);
        generateCloud(dom.typeCloud, [...typeSet].sort(), selectedTypes);
        generateCloud(dom.tagCloud, [...tagSet].sort(), selectedTags);
    }

    function generateCloud(container, items, arr) {
        if (!container) return;
        container.innerHTML = '';

        items.forEach(item => {
            const pill = document.createElement('span');
            pill.className = 'interactive-pill';
            pill.textContent = item;

            if (arr.includes(item)) pill.classList.add('selected');

            pill.addEventListener('click', () => {
                const i = arr.indexOf(item);
                if (i > -1) arr.splice(i, 1); else arr.push(item);
                pill.classList.toggle('selected');
                lastFilterKey = '';
                renderBills();
            });

            container.appendChild(pill);
        });
    }

    function compareDateValues(left, right, ascending) {
        const leftTime = left?.getTime?.() ?? NaN;
        const rightTime = right?.getTime?.() ?? NaN;
        const leftMissing = Number.isNaN(leftTime);
        const rightMissing = Number.isNaN(rightTime);

        if (leftMissing || rightMissing) {
            if (leftMissing && rightMissing) return 0;
            return leftMissing ? 1 : -1;
        }

        return ascending ? leftTime - rightTime : rightTime - leftTime;
    }

    function compareBillValues(left, right, field, ascending) {
        if (field === 'introduced') {
            return compareDateValues(left._sortIntroduced, right._sortIntroduced, ascending);
        }
        if (field === 'modified') {
            return compareDateValues(left._sortModified, right._sortModified, ascending);
        }
        if (field === 'number') {
            if (left._hasSortNumber !== right._hasSortNumber) return left._hasSortNumber ? -1 : 1;
            const difference = ascending
                ? left._sortNumber - right._sortNumber
                : right._sortNumber - left._sortNumber;
            return difference;
        }

        const leftValue = String(left[field] || '').toLocaleLowerCase();
        const rightValue = String(right[field] || '').toLocaleLowerCase();
        return ascending
            ? leftValue.localeCompare(rightValue)
            : rightValue.localeCompare(leftValue);
    }

    function compareBills(left, right) {
        const primary = compareBillValues(left, right, currentSortField, isAscending);
        if (primary) return primary;

        const secondaryFields = currentSortField === 'modified'
            ? ['introduced', 'number']
            : currentSortField === 'introduced'
                ? ['modified', 'number']
                : ['number', 'modified'];

        for (const field of secondaryFields) {
            const result = compareBillValues(left, right, field, false);
            if (result) return result;
        }

        return String(left.number || '').localeCompare(String(right.number || ''), undefined, { numeric: true });
    }

    const expandedLegislationBills = new Set();

    function getBillUid(bill) {
        return bill?._uid || bill?.number || '';
    }

    function findBillByUid(uid) {
        if (!uid) return null;
        return bills.find(bill => getBillUid(bill) === uid) || null;
    }

    function getAmendmentPresentation(bill, amendment, index = 0) {
        const displayNo = getAmendmentDisplayNumber(bill, amendment, index);
        const label = getAmendmentLabel(amendment, index);
        return {
            displayNo,
            label,
            status: getAmendmentStatus(amendment),
            introduced: getAmendmentIntroduced(bill, amendment),
            modified: getAmendmentModified(amendment),
            titleAttr: escapeHtml(label),
        };
    }

    function onLegislationTablesClick(e) {
        const toggle = e.target.closest('.legislation-amend-toggle');
        if (toggle) {
            e.preventDefault();
            e.stopPropagation();
            const billRow = toggle.closest('tr.legislation-bill-row');
            if (!billRow) return;
            const uid = billRow.dataset.billUid || '';
            const open = !billRow.classList.contains('is-expanded');
            let cursor = billRow.nextElementSibling;
            while (cursor && cursor.classList.contains('legislation-amendment-row')) {
                cursor.hidden = !open;
                cursor = cursor.nextElementSibling;
            }
            billRow.classList.toggle('is-expanded', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (uid) {
                if (open) expandedLegislationBills.add(uid);
                else expandedLegislationBills.delete(uid);
            }
            return;
        }

        const amendmentRow = e.target.closest('tr.legislation-amendment-row');
        if (amendmentRow) {
            const bill = findBillByUid(amendmentRow.dataset.billUid);
            if (!bill) return;
            showBillDetails(bill, {
                tab: 'amendments',
                highlightId: amendmentRow.dataset.amendmentKey || '',
            });
            return;
        }

        const billRow = e.target.closest('tr.legislation-bill-row');
        if (billRow) {
            const bill = findBillByUid(billRow.dataset.billUid);
            if (bill) showBillDetails(bill);
        }
    }

    function renderBills() {
        if (!dom.dynamicContainer) return;
        const data = getFilteredBills();
        dom.dynamicContainer.innerHTML = '';

        if (!data.length) {
            const hasFilters = selectedTags.length || selectedStatuses.length || selectedTypes.length;
            if (hasFilters && bills.length) {
                dom.dynamicContainer.innerHTML = emptyStateHTML(
                    'No bills match the current filters.',
                    '\u003cbutton type="button" class="terminal-btn terminal-colors" onclick="clearLegislationFilters()">Clear filters\u003c/button>'
                );
            } else {
                dom.dynamicContainer.innerHTML = emptyStateHTML('No legislation on record.');
            }
            updateSortUIIndicators();
            return;
        }

        const groups = {};
        if (activeViewMode === "none") {
            groups["All Bills Cluster"] = [...data];
        } else {
            data.forEach(b => {
                const k = activeViewMode === 'session'
                    ? getSessionPrefix(b.number) || "UNASSIGNED"
                    : b[activeViewMode] || "UNASSIGNED";
                if (!groups[k]) groups[k] = [];
                groups[k].push(b);
            });
        }

        Object.keys(groups)
            .sort((a, b) => {
                if (activeViewMode !== 'session') return a.localeCompare(b);
                if (a === 'UNASSIGNED') return 1;
                if (b === 'UNASSIGNED') return -1;
                return Number(b) - Number(a);
            })
            .forEach(groupKey => {
                let items = groups[groupKey];
                if (currentSortField) {
                    items = [...items].sort(compareBills);
                }

                const groupTitle = activeViewMode === "none"
                    ? "General Records"
                    : activeViewMode === "session" && groupKey !== "UNASSIGNED"
                        ? `No. ${groupKey}`
                        : groupKey;

                const block = document.createElement('div');
                block.className = 'ly-tier-banner';
                block.style.marginBottom = '30px';
                block.innerHTML = `
                        \u003cdiv class="ly-tier-banner-header">
                            \u003cdiv>
                                \u003cdiv class="ly-tier-label">${activeViewMode === "none" ? "All Legislation" : activeViewMode}\u003c/div>
                                \u003cdiv class="ly-tier-title">${escapeHtml(groupTitle)}\u003c/div>
                            \u003c/div>
                        \u003c/div>
                        \u003cdiv class="ly-tier-banner-body" style="padding: 0;">
                            \u003ctable class="wn-table-striped legislation-table" style="margin: 0; width: 100%;">
                                \u003cthead>
                                    \u003ctr>
                                        \u003cth style="width: 70px; text-align: center;">No.\u003c/th>
                                        \u003cth>Title\u003c/th>
                                        \u003cth style="width: 110px; text-align: left;">Type\u003c/th>
                                        \u003cth style="width: 110px; text-align: center;">Status\u003c/th>
                                        \u003cth style="width: 105px; text-align: center;">Introduced\u003c/th>
                                        \u003cth style="width: 105px; text-align: center;">Modified\u003c/th>
                                        \u003cth class="legislation-expand-col" aria-label="Amendments">\u003c/th>
                                    \u003c/tr>
                                \u003c/thead>
                                \u003ctbody>\u003c/tbody>
                            \u003c/table>
                        \u003c/div>
                    `;

                const tbody = block.querySelector('tbody');
                const frag = document.createDocumentFragment();

                items.forEach((bill, billIndex) => {
                    const amendments = getBillAmendments(bill);
                    const hasAmendments = amendments.length > 0;
                    const uid = getBillUid(bill);
                    const expanded = hasAmendments && expandedLegislationBills.has(uid);
                    const row = document.createElement('tr');
                    row.className = 'legislation-bill-row';
                    row.classList.add(billIndex % 2 === 0 ? 'is-stripe-odd' : 'is-stripe-even');
                    row.dataset.billUid = uid;
                    row.tabIndex = 0;
                    row.setAttribute('role', 'button');
                    if (hasAmendments) row.classList.add('has-amendments');
                    if (expanded) row.classList.add('is-expanded');

                    const billTitle = bill.title || 'N/A';
                    const expandCell = hasAmendments
                        ? `\u003ctd class="legislation-expand-col">
                                \u003cbutton type="button" class="legislation-amend-toggle" aria-expanded="${expanded ? 'true' : 'false'}"
                                    aria-label="Show amendments for ${escapeHtml(bill.title || bill.number || 'bill')}">
                                    \u003cspan class="legislation-amend-caret">▼\u003c/span>
                                \u003c/button>
                            \u003c/td>`
                        : `\u003ctd class="legislation-expand-col">\u003c/td>`;

                    row.innerHTML = `
                        \u003ctd class="wn-text-mono" style="text-align: center; font-size: 13px;">${escapeHtml(bill.number || 'N/A')}\u003c/td>
                        \u003ctd class="legislation-title-cell" title="${escapeHtml(billTitle)}">${escapeHtml(billTitle)}\u003c/td>
                        \u003ctd>${getTypeHTML(bill.type || 'N/A')}\u003c/td>
                        \u003ctd style="text-align: center;">${getStatusHTML(bill.status || 'N/A')}\u003c/td>
                        \u003ctd class="wn-text-mono" style="text-align: center; font-size: 13px;">${escapeHtml(formatDisplayDate(bill.introduced || 'N/A'))}\u003c/td>
                        \u003ctd class="wn-text-mono" style="text-align: center; font-size: 13px;">${escapeHtml(formatDisplayDate(bill.modified || 'N/A'))}\u003c/td>
                        ${expandCell}
                    `;

                    frag.appendChild(row);

                    if (hasAmendments) {
                        getBillAmendmentsForDisplay(bill).forEach(({ amendment, index }, displayIndex) => {
                            const presentation = getAmendmentPresentation(bill, amendment, index);
                            const aRow = document.createElement('tr');
                            aRow.className = 'legislation-amendment-row';
                            aRow.classList.add(displayIndex % 2 === 0 ? 'is-stripe-odd' : 'is-stripe-even');
                            aRow.hidden = !expanded;
                            aRow.dataset.billUid = uid;
                            aRow.dataset.amendmentKey = presentation.displayNo;
                            aRow.tabIndex = 0;
                            aRow.setAttribute('role', 'button');
                            aRow.innerHTML = `
                                \u003ctd class="wn-text-mono" style="text-align: center; font-size: 13px;">${escapeHtml(presentation.displayNo)}\u003c/td>
                                \u003ctd class="legislation-title-cell" title="${presentation.titleAttr}">${escapeHtml(presentation.label)}\u003c/td>
                                \u003ctd class="legislation-amendment-type">\u003c/td>
                                \u003ctd style="text-align: center;">${getStatusHTML(presentation.status)}\u003c/td>
                                \u003ctd class="wn-text-mono" style="text-align: center; font-size: 13px;">${escapeHtml(formatOptionalDisplayDate(presentation.introduced))}\u003c/td>
                                \u003ctd class="wn-text-mono" style="text-align: center; font-size: 13px;">${escapeHtml(formatOptionalDisplayDate(presentation.modified))}\u003c/td>
                                \u003ctd class="legislation-expand-col">\u003c/td>
                            `;
                            frag.appendChild(aRow);
                        });
                    }
                });

                tbody.appendChild(frag);
                dom.dynamicContainer.appendChild(block);
            });

        updateSortUIIndicators();
    }

    //  BILL MODAL / COUNTERS

    let activeBillModalTab = 'details';
    let amendmentsContextBill = null;
    let amendmentDrillIndex = null;

    function getBillAmendments(bill) {
        return Array.isArray(bill?.amendments) ? bill.amendments.filter(Boolean) : [];
    }

    // Newest first for display (last amendments[] entry on top). Letters still follow data order (first=A).
    function getBillAmendmentsForDisplay(bill) {
        const amendments = getBillAmendments(bill);
        return amendments
            .map((amendment, index) => ({ amendment, index }))
            .reverse();
    }

    function normalizeSponsorNames(source) {
        if (Array.isArray(source)) {
            return source.map(s => {
                if (typeof s === 'string') return s.trim();
                if (s && typeof s.name === 'string') return s.name.trim();
                return '';
            }).filter(Boolean);
        }
        if (typeof source === 'string') {
            const name = source.trim();
            return name ? [name] : [];
        }
        return [];
    }

    function getAmendmentLabel(amendment, index = 0) {
        const title = typeof amendment?.title === 'string' ? amendment.title.trim() : '';
        if (title) return title;
        const id = typeof amendment?.id === 'string' ? amendment.id.trim() : '';
        if (id) return id;
        return `Amendment ${index + 1}`;
    }

    function getAmendmentText(amendment) {
        return amendment?.text != null ? String(amendment.text).trim() : '';
    }

    function getAmendmentStatus(amendment) {
        const status = amendment?.status != null ? String(amendment.status).trim() : '';
        return status || 'N/A';
    }

    function getAmendmentParentNumber(bill) {
        return String(bill?.number || '').trim() || '0-00';
    }

    function getAmendmentSuffix(bill, amendment, index = 0) {
        const rawId = typeof amendment?.id === 'string' ? amendment.id.trim() : '';
        const parentActual = String(bill?.number || '').trim();
        let suffix = '';

        if (rawId) {
            if (parentActual) {
                const prefix = `${parentActual}-`;
                if (rawId.toLowerCase() === parentActual.toLowerCase()) {
                    suffix = '';
                } else if (rawId.toLowerCase().startsWith(prefix.toLowerCase())) {
                    suffix = rawId.slice(prefix.length);
                } else {
                    suffix = rawId.includes('-')
                        ? (rawId.split('-').filter(Boolean).pop() || rawId)
                        : rawId;
                }
            } else {
                suffix = rawId.includes('-')
                    ? (rawId.split('-').filter(Boolean).pop() || rawId)
                    : rawId;
            }
        }

        if (!suffix) suffix = String.fromCharCode(65 + (index % 26));
        return suffix.toUpperCase();
    }

    function getAmendmentDisplayNumber(bill, amendment, index = 0) {
        return `${getAmendmentParentNumber(bill)}-${getAmendmentSuffix(bill, amendment, index)}`;
    }

    function getAmendmentIntroduced(bill, amendment) {
        const own = amendment?.introduced != null ? String(amendment.introduced).trim() : '';
        if (own) return own;
        return bill?.introduced != null ? String(bill.introduced).trim() : '';
    }

    function getAmendmentModified(amendment) {
        return amendment?.modified != null ? String(amendment.modified).trim() : '';
    }

    function formatOptionalDisplayDate(value) {
        return value ? formatDisplayDate(value) : '';
    }

    function amendmentMatchesKey(bill, amendment, index, key) {
        if (key == null || key === '') return false;
        const needle = String(key).trim().toLowerCase();
        if (!needle) return false;
        const displayNo = getAmendmentDisplayNumber(bill, amendment, index).toLowerCase();
        const rawId = typeof amendment?.id === 'string' ? amendment.id.trim().toLowerCase() : '';
        const suffix = getAmendmentSuffix(bill, amendment, index).toLowerCase();
        return displayNo === needle
            || rawId === needle
            || suffix === needle
            || String(index) === needle;
    }

    function resolveExternalHref(value) {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw) return '';
        const withProtocol = raw.startsWith('http') ? raw : `https://${raw}`;
        return safeUrl(withProtocol, '');
    }

    function setFooterLinkVisible(linkEl, containerEl, href, label) {
        if (!linkEl) return;
        if (href) {
            linkEl.href = href;
            if (label) linkEl.textContent = label;
            if (containerEl) containerEl.classList.add('is-visible');
        } else {
            linkEl.href = '#';
            if (containerEl) containerEl.classList.remove('is-visible');
        }
    }

    function rebuildMemberColorMap() {
        Object.keys(memberColorMap).forEach(k => delete memberColorMap[k]);

        const register = (entry) => {
            if (!entry || typeof entry.name !== 'string') return;
            const name = entry.name.trim();
            if (!name) return;
            const party = typeof entry.party === 'string' ? entry.party.trim() : '';
            const override = entry.partyColor;
            const color = (typeof override === 'string' && override.trim())
                ? override.trim()
                : (party && partyColorMap[party]) || null;
            memberColorMap[name] = { party, color };
        };

        (memberArchive || []).forEach(register);
        (roster || []).forEach(register);
    }

    function resolveVoter(entry) {
        let name = '';
        let party = '';
        let partyColor = '';

        if (typeof entry === 'string') {
            name = entry.trim();
        } else if (entry && typeof entry === 'object') {
            name = typeof entry.name === 'string' ? entry.name.trim() : '';
            party = typeof entry.party === 'string' ? entry.party.trim() : '';
            partyColor = typeof entry.partyColor === 'string' ? entry.partyColor.trim() : '';
        }

        if (!name) return null;

        const known = memberColorMap[name];
        const resolvedParty = party || known?.party || '';
        const rawColor = partyColor || known?.color || (resolvedParty ? partyColorMap[resolvedParty] : null) || null;
        const color = rawColor ? safeColor(rawColor, '') || null : null;

        return { name, party: resolvedParty, color };
    }

    function normalizeVoteList(list) {
        if (!Array.isArray(list)) return [];
        return list.map(resolveVoter).filter(Boolean);
    }

    function setBillModalTab(tab, options = {}) {
        const allowed = ['details', 'votes', 'amendments'];
        const nextTab = allowed.includes(tab) ? tab : 'details';
        activeBillModalTab = nextTab;

        const panels = {
            details: dom.modalPanelDetails || $('#modal-panel-details'),
            votes: dom.modalPanelVotes || $('#modal-panel-votes'),
            amendments: dom.modalPanelAmendments || $('#modal-panel-amendments'),
        };
        const tabs = {
            details: dom.modalTabDetails || $('#modal-tab-details'),
            votes: dom.modalTabVotes || $('#modal-tab-votes'),
            amendments: dom.modalTabAmendments || $('#modal-tab-amendments'),
        };

        allowed.forEach(name => {
            const isActive = activeBillModalTab === name;
            if (panels[name]) {
                panels[name].classList.toggle('active', isActive);
                panels[name].hidden = !isActive;
                panels[name].setAttribute('aria-hidden', isActive ? 'false' : 'true');
            }
            if (tabs[name]) {
                tabs[name].classList.toggle('active', isActive);
                tabs[name].setAttribute('aria-selected', isActive ? 'true' : 'false');
                tabs[name].tabIndex = isActive ? 0 : -1;
            }
        });

        if (options.syncAmendments === false) return;

        if (nextTab === 'amendments' && amendmentsContextBill) {
            if (amendmentDrillIndex != null) {
                showAmendmentDrillView(amendmentsContextBill, amendmentDrillIndex);
            } else {
                renderBillAmendments(amendmentsContextBill);
            }
        } else if (amendmentsContextBill) {
            applyBillModalHeader(amendmentsContextBill);
            syncModalFooterLink(amendmentsContextBill.link);
            setAmendmentBackVisible(false);
        }
    }

    function onBillModalTablistKeydown(e) {
        const order = ['details', 'amendments', 'votes'];
        const currentIndex = order.indexOf(activeBillModalTab);
        if (currentIndex < 0) return;

        let nextIndex = currentIndex;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % order.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            nextIndex = (currentIndex - 1 + order.length) % order.length;
        } else if (e.key === 'Home') {
            nextIndex = 0;
        } else if (e.key === 'End') {
            nextIndex = order.length - 1;
        } else {
            return;
        }

        e.preventDefault();
        setBillModalTab(order[nextIndex]);
        const tabs = {
            details: dom.modalTabDetails,
            amendments: dom.modalTabAmendments,
            votes: dom.modalTabVotes,
        };
        tabs[order[nextIndex]]?.focus();
    }

    function onBillModalKeydown(e) {
        if (!dom.billModal?.classList.contains('is-open')) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            return;
        }
        if (e.key !== 'Tab') return;

        const focusable = [...dom.billModal.querySelectorAll(
            'button:not([hidden]):not([disabled]), [href]:not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])'
        )].filter(el => el.offsetParent !== null || el === document.activeElement);
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function fillVoteColumn(listEl, voters) {
        if (!listEl) return;
        listEl.innerHTML = '';
        if (!voters.length) {
            listEl.innerHTML = '\u003cspan style="display:block;text-align:center;color:#6a6a7a;padding:12px 4px;">—\u003c/span>';
            return;
        }
        voters.forEach(voter => {
            const row = document.createElement('div');
            row.className = 'vote-name';
            if (voter.color) {
                const dot = document.createElement('span');
                dot.className = 'vote-name-dot';
                dot.style.color = voter.color;
                dot.textContent = '●';
                row.appendChild(dot);
            }
            const label = document.createElement('span');
            label.textContent = voter.name;
            row.appendChild(label);
            listEl.appendChild(row);
        });
    }

    function renderBillVotes(bill) {
        const votes = bill?.votes || {};
        const aye = normalizeVoteList(votes.aye);
        const abstain = normalizeVoteList(votes.abstain);
        const nay = normalizeVoteList(votes.nay);
        const total = aye.length + abstain.length + nay.length;

        const setCount = (id, n) => {
            const el = $(id);
            if (el) el.textContent = String(n);
        };
        setCount('#vote-count-aye', aye.length);
        setCount('#vote-count-abstain', abstain.length);
        setCount('#vote-count-nay', nay.length);

        const pct = (n) => total ? `${(n / total) * 100}%` : '0%';
        const barAye = $('#vote-bar-aye');
        const barAbstain = $('#vote-bar-abstain');
        const barNay = $('#vote-bar-nay');
        if (barAye) barAye.style.width = pct(aye.length);
        if (barAbstain) barAbstain.style.width = pct(abstain.length);
        if (barNay) barNay.style.width = pct(nay.length);

        fillVoteColumn(dom.voteListAye || $('#vote-list-aye'), aye);
        fillVoteColumn(dom.voteListAbstain || $('#vote-list-abstain'), abstain);
        fillVoteColumn(dom.voteListNay || $('#vote-list-nay'), nay);

        const emptyMsg = dom.votesEmptyMsg || $('#votes-empty-msg');
        const columns = dom.votesColumns || document.querySelector('#modal-panel-votes .votes-columns');
        const summary = dom.votesSummary || document.querySelector('#modal-panel-votes .votes-summary');
        const bar = dom.voteBar || $('#vote-bar');
        const live = dom.voteLiveSummary || $('#vote-live-summary');
        const showEmpty = total === 0;

        if (emptyMsg) {
            if (showEmpty) {
                emptyMsg.hidden = false;
                emptyMsg.innerHTML = emptyStateHTML('No votes recorded for this bill.');
            } else {
                emptyMsg.hidden = true;
                emptyMsg.innerHTML = '';
            }
        }
        if (columns) columns.style.display = showEmpty ? 'none' : '';
        if (summary) summary.style.display = showEmpty ? 'none' : '';
        if (bar) bar.style.display = showEmpty ? 'none' : '';
        if (live) {
            live.textContent = showEmpty
                ? 'No votes recorded for this bill.'
                : `${aye.length} aye, ${abstain.length} abstain, ${nay.length} nay.`;
        }
    }

    function clearAmendmentDrillState() {
        amendmentDrillIndex = null;
        setAmendmentBackVisible(false);
    }

    function setAmendmentBackVisible(visible) {
        const backBtn = dom.modalAmendmentBack || $('#modal-amendment-back');
        if (backBtn) backBtn.hidden = !visible;
    }

    function syncModalFooterLink(billLinkValue, amendmentLinkValue = null) {
        setFooterLinkVisible(
            dom.modalLink,
            dom.modalLinkContainer,
            resolveExternalHref(billLinkValue),
            'link'
        );
        setFooterLinkVisible(
            dom.modalAmendmentLink || $('#modal-amendment-link'),
            dom.modalAmendmentLinkContainer || $('#modal-amendment-link-container'),
            resolveExternalHref(amendmentLinkValue),
            'Amendment Link'
        );
    }

    function applyBillModalHeader(bill) {
        if (!bill) return;
        const billSession = getSessionPrefix(bill.number) || 'N/A';
        if (dom.modalNumber) {
            dom.modalNumber.textContent = `Bill ${bill.number || 'N/A'} · Session ${billSession} · ${bill.type || 'N/A'}`;
        }
        if (dom.modalTitle) {
            dom.modalTitle.textContent = bill.title || 'Untitled Bill';
        }
    }

    function applyAmendmentModalHeader(bill, amendment, index = 0) {
        const displayNo = getAmendmentDisplayNumber(bill, amendment, index);
        const label = getAmendmentLabel(amendment, index);
        const parentNo = getAmendmentParentNumber(bill);
        if (dom.modalNumber) {
            dom.modalNumber.textContent = `Amendment ${displayNo} · Bill ${parentNo}`;
        }
        if (dom.modalTitle) {
            dom.modalTitle.textContent = label;
        }
    }

    function buildAmendmentListView(bill, amendments, highlightId) {
        const wrap = document.createElement('div');
        wrap.className = 'amendments-list-view';

        const tableWrap = document.createElement('div');
        tableWrap.className = 'amendments-table-wrap';
        tableWrap.innerHTML = `
            \u003ctable class="wn-table-striped legislation-table amendments-table" style="margin:0;width:100%;">
                \u003cthead>
                    \u003ctr>
                        \u003cth style="width:90px;text-align:center;">No.\u003c/th>
                        \u003cth>Title\u003c/th>
                        \u003cth style="width:120px;text-align:center;">Status\u003c/th>
                        \u003cth style="width:110px;text-align:center;">Introduced\u003c/th>
                        \u003cth style="width:110px;text-align:center;">Modified\u003c/th>
                    \u003c/tr>
                \u003c/thead>
                \u003ctbody>\u003c/tbody>
            \u003c/table>
        `;

        const tbody = tableWrap.querySelector('tbody');
        getBillAmendmentsForDisplay(bill).forEach(({ amendment, index }) => {
            const presentation = getAmendmentPresentation(bill, amendment, index);
            const row = document.createElement('tr');
            row.className = 'amendment-table-row';
            row.style.cursor = 'pointer';
            row.setAttribute('role', 'button');
            row.tabIndex = 0;
            row.dataset.amendmentKey = presentation.displayNo;
            if (highlightId && amendmentMatchesKey(bill, amendment, index, highlightId)) {
                row.classList.add('is-targeted');
            }

            row.innerHTML = `
                \u003ctd class="wn-text-mono" style="text-align:center;font-size:13px;">${escapeHtml(presentation.displayNo)}\u003c/td>
                \u003ctd class="legislation-title-cell" title="${presentation.titleAttr}">${escapeHtml(presentation.label)}\u003c/td>
                \u003ctd style="text-align:center;">${getStatusHTML(presentation.status)}\u003c/td>
                \u003ctd class="wn-text-mono" style="text-align:center;font-size:13px;">${escapeHtml(formatOptionalDisplayDate(presentation.introduced))}\u003c/td>
                \u003ctd class="wn-text-mono" style="text-align:center;font-size:13px;">${escapeHtml(formatOptionalDisplayDate(presentation.modified))}\u003c/td>
            `;

            const openDrill = () => showAmendmentDrillView(bill, index);
            row.addEventListener('click', openDrill);
            row.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDrill();
                }
            });
            tbody.appendChild(row);
        });

        wrap.appendChild(tableWrap);
        return wrap;
    }

    function buildAmendmentDrillView(bill, amendment, index) {
        const displayNo = getAmendmentDisplayNumber(bill, amendment, index);
        const label = getAmendmentLabel(amendment, index);
        const status = getAmendmentStatus(amendment);
        const sponsors = normalizeSponsorNames(
            amendment.sponsors != null ? amendment.sponsors : amendment.sponsor
        );
        const introduced = getAmendmentIntroduced(bill, amendment);
        const modified = getAmendmentModified(amendment);
        const text = getAmendmentText(amendment);

        const view = document.createElement('div');
        view.className = 'amendment-drill-view';
        view.innerHTML = `
            \u003cdiv class="modal-box-top">
                \u003cdiv class="modal-metadata-grid amendment-drill-meta-grid">
                    \u003cdiv>
                        \u003cspan class="wn-eyebrow">No.\u003c/span>
                        \u003cp class="wn-text-mono" style="margin-top:4px;font-size:13px;">${escapeHtml(displayNo)}\u003c/p>
                    \u003c/div>
                    \u003cdiv>
                        \u003cspan class="wn-eyebrow">Title\u003c/span>
                        \u003cp style="margin-top:4px;font-size:14px;">${escapeHtml(label)}\u003c/p>
                    \u003c/div>
                    \u003cdiv>
                        \u003cspan class="wn-eyebrow">Sponsor\u003c/span>
                        \u003cp class="modal-scroll-limit" style="margin-top:4px;font-size:14px;">${escapeHtml(sponsors.length ? sponsors.join(', ') : 'N/A')}\u003c/p>
                    \u003c/div>
                    \u003cdiv>
                        \u003cspan class="wn-eyebrow">Introduced\u003c/span>
                        \u003cp style="margin-top:4px;font-size:14px;">${escapeHtml(formatOptionalDisplayDate(introduced))}\u003c/p>
                    \u003c/div>
                    \u003cdiv>
                        \u003cspan class="wn-eyebrow">Modified\u003c/span>
                        \u003cp style="margin-top:4px;font-size:14px;">${escapeHtml(formatOptionalDisplayDate(modified))}\u003c/p>
                    \u003c/div>
                    \u003cdiv style="justify-self:start;text-align:center;">
                        \u003cspan class="wn-eyebrow">Status\u003c/span>
                        \u003cp style="margin-top:4px;">${getStatusHTML(status)}\u003c/p>
                    \u003c/div>
                \u003c/div>
            \u003c/div>
            \u003chr style="margin:0 0 12px 0;">
            \u003cdiv class="amendment-change-block${text ? '' : ' is-empty'}" style="margin-bottom:24px;">
                \u003cspan class="wn-eyebrow amendment-change-label"
                    style="border-bottom:2px solid var(--wn-accent);padding-bottom:2px;">Description\u003c/span>
                \u003cp class="amendment-change-text" style="margin-top:10px;line-height: 1.75;background: rgba(0, 0, 0, 0.1);border-radius: 6px;min-height: 80px;padding: 10px;font-size: 13.5px;">${text ? escapeHtml(text) : 'No description provided.'}\u003c/p>
            \u003c/div>
        `;
        return view;
    }

    function showAmendmentListView(bill, options = {}) {
        const listEl = dom.modalAmendmentsList || $('#modal-amendments-list');
        if (!listEl || !bill) return;

        amendmentsContextBill = bill;
        amendmentDrillIndex = null;
        setAmendmentBackVisible(false);
        applyBillModalHeader(bill);
        syncModalFooterLink(bill.link);

        const amendments = getBillAmendments(bill);
        listEl.innerHTML = '';
        listEl.appendChild(buildAmendmentListView(bill, amendments, options.highlightId || null));

        if (options.highlightId) {
            const targeted = listEl.querySelector('.amendment-table-row.is-targeted');
            if (targeted) {
                requestAnimationFrame(() => {
                    targeted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                });
            }
        }
    }

    function showAmendmentDrillView(bill, index) {
        const listEl = dom.modalAmendmentsList || $('#modal-amendments-list');
        if (!listEl || !bill) return;

        const amendments = getBillAmendments(bill);
        const amendment = amendments[index];
        if (!amendment) {
            showAmendmentListView(bill);
            return;
        }

        amendmentsContextBill = bill;
        amendmentDrillIndex = index;
        setAmendmentBackVisible(activeBillModalTab === 'amendments');
        applyAmendmentModalHeader(bill, amendment, index);
        syncModalFooterLink(bill.link, amendment.link);

        listEl.innerHTML = '';
        listEl.appendChild(buildAmendmentDrillView(bill, amendment, index));
    }

    function renderBillAmendments(bill, options = {}) {
        const listEl = dom.modalAmendmentsList || $('#modal-amendments-list');
        const emptyMsg = dom.amendmentsEmptyMsg || $('#amendments-empty-msg');
        if (!listEl) return;

        amendmentsContextBill = bill;
        const amendments = getBillAmendments(bill);
        listEl.innerHTML = '';

        if (!amendments.length) {
            clearAmendmentDrillState();
            if (emptyMsg) {
                emptyMsg.hidden = false;
                emptyMsg.innerHTML = emptyStateHTML('No amendments recorded for this bill.');
            }
            return;
        }

        if (emptyMsg) {
            emptyMsg.hidden = true;
            emptyMsg.innerHTML = '';
        }

        const highlightId = options.highlightId != null ? String(options.highlightId) : null;
        const drillIndex = highlightId
            ? amendments.findIndex((amendment, index) =>
                amendmentMatchesKey(bill, amendment, index, highlightId)
            )
            : -1;

        if (drillIndex >= 0) {
            showAmendmentDrillView(bill, drillIndex);
            return;
        }

        showAmendmentListView(bill, { highlightId });
    }

    function showBillDetails(bill, options = {}) {
        if (!dom.billModal) return;

        const initialTab = options.tab === 'votes' || options.tab === 'amendments'
            ? options.tab
            : 'details';
        const highlightId = options.highlightId != null ? String(options.highlightId) : null;

        amendmentsContextBill = bill;
        amendmentDrillIndex = null;
        setAmendmentBackVisible(false);

        setBillModalTab(initialTab, { syncAmendments: false });
        renderBillVotes(bill);
        renderBillAmendments(bill, { highlightId });

        if (!(initialTab === 'amendments' && amendmentDrillIndex != null)) {
            applyBillModalHeader(bill);
            syncModalFooterLink(bill.link);
            setAmendmentBackVisible(false);
        }

        dom.modalType.innerHTML = getTypeHTML(bill.type || 'N/A');
        dom.modalStatus.innerHTML = getStatusHTML(bill.status || 'N/A');
        const sponsors = normalizeSponsorNames(
            bill.sponsors != null ? bill.sponsors : bill.sponsor
        );
        dom.modalSponsor.textContent = sponsors.length ? sponsors.join(', ') : 'N/A';
        const partyNames = (Array.isArray(bill.parties)
            ? bill.parties
            : bill.party ? [bill.party] : [])
            .map(name => typeof name === 'string' ? name.trim() : '')
            .filter(Boolean);
        if (dom.modalPartyContainer) {
            dom.modalPartyContainer.style.display = partyNames.length ? 'block' : 'none';
        }
        if (partyNames.length && dom.modalParty) {
            dom.modalParty.innerHTML = partyNames.map((name, idx) => {
                const safeName = escapeHtml(name);
                const partyDotColor = safeColor(partyColorMap[name] || '#888');
                const comma = idx < partyNames.length - 1
                    ? '\u003cspan style="color:var(--wn-text); margin-right: 8px">,\u003c/span>'
                    : '';
                return `\u003cspan style="color:${partyDotColor};margin-right:4px;">●\u003c/span>` +
                    `\u003cspan style="color:color-mix(in srgb, ${partyDotColor} 85%, var(--wn-text));font-weight:500;">${safeName}\u003c/span>${comma}`;
            }).join('');
        } else if (dom.modalParty) {
            dom.modalParty.innerHTML = '';
        }
        const billDescription = bill.description != null ? String(bill.description).trim() : '';
        const hasDescription = billDescription.length > 0;
        dom.modalDescription.textContent = hasDescription ? billDescription : 'No description provided.';
        if (dom.modalDescriptionContainer) {
            dom.modalDescriptionContainer.classList.toggle('is-empty', !hasDescription);
        }
        dom.modalIntroduced.textContent = formatDisplayDate(bill.introduced || 'N/A');
        dom.modalModified.textContent = formatDisplayDate(bill.modified || 'N/A');

        const hasStage = bill.stage && bill.stage.trim() && bill.stage.toUpperCase() !== "N/A";
        if (dom.modalStageContainer) {
            dom.modalStageContainer.style.display = hasStage ? 'block' : 'none';
            if (hasStage && dom.modalStage) dom.modalStage.textContent = bill.stage;
        }

        const validTags = (bill.tags || []).filter(t => t?.trim());
        if (dom.modalTagsContainer) {
            dom.modalTagsContainer.style.display = validTags.length ? 'block' : 'none';
            if (validTags.length && dom.modalTags) {
                dom.modalTags.innerHTML = validTags
                    .map(t => `\u003cspan class="modal-tag">${escapeHtml(t.trim())}\u003c/span>`)
                    .join('');
            }
        }

        openBillModal();
    }

    let billModalLastFocus = null;

    function openBillModal() {
        if (!dom.billModal) return;
        billModalLastFocus = document.activeElement;
        dom.billModal.classList.add('is-open');
        dom.billModal.style.display = 'flex';
        dom.billModal.setAttribute('aria-hidden', 'false');
        const focusTarget = dom.modalCloseBtn || dom.modalTabDetails || dom.billModal;
        requestAnimationFrame(() => focusTarget.focus?.());
    }

    function closeModal() {
        if (dom.billModal) {
            dom.billModal.classList.remove('is-open');
            dom.billModal.style.display = 'none';
            dom.billModal.setAttribute('aria-hidden', 'true');
        }
        amendmentsContextBill = null;
        clearAmendmentDrillState();
        setBillModalTab('details', { syncAmendments: false });
        if (billModalLastFocus && typeof billModalLastFocus.focus === 'function') {
            billModalLastFocus.focus();
        }
        billModalLastFocus = null;
    }

    function onBillModalBackdropClick(e) {
        if (e.target === dom.billModal) closeModal();
    }

    function renderBillCount() {
        let active = 0;
        let pending = 0;
        bills.forEach(bill => {
            const status = (bill.status || '').toString().trim().toLowerCase();
            if (status === 'active' || status === 'passed') active += 1;
            if (status === 'pending') pending += 1;
        });
        if (dom.billCount) dom.billCount.textContent = active;
        if (dom.pendingBillCount) dom.pendingBillCount.textContent = pending;
    }

    function renderCommitteeCount() {
        if (!dom.committeeCount) return;
        const activeCount = (committees || []).filter(c =>
            String(c.status || '').trim().toLowerCase() === 'active'
        ).length;
        dom.committeeCount.textContent = String(activeCount);
    }

    //  INIT


    function init() {
        dom.rosterTbody = $('#roster-tbody');
        dom.partyLegend = $('#party-legend');
        dom.partyBoxes = $('#party-boxes');
        dom.seatMap = $('#seatMap');
        dom.seatTooltip = $('#seat-tooltip');
        dom.decreesContent = $('#decrees-content');
        dom.dynamicContainer = $('#dynamic-tables-container');
        dom.committeesContent = $('#committees-content');
        dom.nextElectionCycle = $('#next-election-cycle');
        dom.sessionNumLabel = $('#session-num-label');
        dom.sessionSubheadLabel = $('#session-subhead-label');
        dom.sessionEyebrowLabel = $('#session-eyebrow-label');
        dom.quorum = $('#quorum');
        dom.billModal = $('#bill-modal');
        dom.modalNumber = $('#modal-number');
        dom.modalTitle = $('#modal-title');
        dom.modalType = $('#modal-type');
        dom.modalStatus = $('#modal-status');
        dom.modalSponsor = $('#modal-sponsor');
        dom.modalParty = $('#modal-party');
        dom.modalPartyContainer = $('#modal-party-container');
        dom.modalDescription = $('#modal-description');
        dom.modalDescriptionContainer = $('#modal-description-container');
        dom.modalIntroduced = $('#modal-introduced');
        dom.modalModified = $('#modal-modified');
        dom.modalLink = $('#modal-link');
        dom.modalLinkContainer = $('#modal-link-container');
        dom.modalAmendmentLink = $('#modal-amendment-link');
        dom.modalAmendmentLinkContainer = $('#modal-amendment-link-container');
        dom.modalStage = $('#modal-stage');
        dom.modalTags = $('#modal-tags');
        dom.modalStageContainer = $('#modal-stage-container');
        dom.modalTagsContainer = $('#modal-tags-container');
        dom.modalCloseBtn = $('#modal-close-btn');
        dom.modalTabDetails = $('#modal-tab-details');
        dom.modalTabAmendments = $('#modal-tab-amendments');
        dom.modalTabVotes = $('#modal-tab-votes');
        dom.modalPanelDetails = $('#modal-panel-details');
        dom.modalPanelAmendments = $('#modal-panel-amendments');
        dom.modalPanelVotes = $('#modal-panel-votes');
        dom.modalAmendmentsList = $('#modal-amendments-list');
        dom.amendmentsEmptyMsg = $('#amendments-empty-msg');
        dom.modalAmendmentBack = $('#modal-amendment-back');
        dom.voteListAye = $('#vote-list-aye');
        dom.voteListAbstain = $('#vote-list-abstain');
        dom.voteListNay = $('#vote-list-nay');
        dom.votesEmptyMsg = $('#votes-empty-msg');
        dom.votesColumns = document.querySelector('#modal-panel-votes .votes-columns');
        dom.votesSummary = document.querySelector('#modal-panel-votes .votes-summary');
        dom.voteBar = $('#vote-bar');
        dom.voteLiveSummary = $('#vote-live-summary');
        dom.billCount = $('#bill-count');
        dom.pendingBillCount = $('#pending-bill-count');
        dom.committeeCount = $('#committee-count');
        dom.districtSeatCount = $('#district-seat-count');
        dom.seatCountText = $('#seat-count-text');
        dom.controlDrawer = $('#control-panel-drawer');
        dom.drawerCaret = $('#drawer-caret');
        dom.legislationDrawerToggle = $('#legislation-drawer-toggle');
        dom.rosterPanel = $('#roster-panel');
        dom.rosterCaret = $('#roster-caret');
        dom.rosterToggleBtn = $('#roster-toggle-btn');
        dom.statusCloud = $('#status-cloud-container');
        dom.typeCloud = $('#type-cloud-container');
        dom.tagCloud = $('#tag-cloud-container');
        dom.newestBill = $('#newest-bill');
        dom.newestDecree = $('#newest-decree');
        dom.newestCommittee = $('#newest-committee');

        rebuildPartyColorMap();
        rebuildMemberColorMap();

        if (dom.dynamicContainer) {
            dom.dynamicContainer.addEventListener('click', onLegislationTablesClick);
            dom.dynamicContainer.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const row = e.target.closest('tr.legislation-bill-row, tr.legislation-amendment-row');
                if (!row || e.target.closest('.legislation-amend-toggle')) return;
                e.preventDefault();
                onLegislationTablesClick(e);
            });
        }

        if (dom.billModal) {
            dom.billModal.addEventListener('click', onBillModalBackdropClick);
            dom.billModal.addEventListener('keydown', onBillModalKeydown);
        }

        const tablist = document.querySelector('#bill-modal .bill-modal-tabs');
        if (tablist) tablist.addEventListener('keydown', onBillModalTablistKeydown);

        if (dom.modalAmendmentBack) {
            dom.modalAmendmentBack.addEventListener('click', () => {
                if (!amendmentsContextBill) return;
                showAmendmentListView(amendmentsContextBill);
                if (activeBillModalTab !== 'amendments') {
                    setBillModalTab('amendments');
                }
            });
        }

        window.addEventListener('click', () => {
            if (activeTooltipCircle) resetTooltip();
            if (activeSeatFocusParties) clearSeatFocus();
        });

        renderPartyLegend();
        renderPartyBoxes();
        setupSeatMap();
        clearPoliticalBlocsCache();
        renderAssemblyComposition();
        renderRoster();
        // Legislations / Committees / Decrees render on first tab open (ensureTabContent).
        updateLegislationControlsVisibility();
        updateLatestEntries();
        renderBillCount();
        renderCommitteeCount();
        renderNextElectionCycle();
        renderSessionLabels();
        renderAssemblyName();
        renderTopPanelConfig();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
