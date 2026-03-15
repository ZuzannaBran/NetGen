// Network Graph Service using force-graph
import ForceGraph from 'force-graph';
import { forceCollide, forceX, forceY } from 'd3-force';

let graphInstance = null;
let currentData = { nodes: [], links: [] };

export function initializeGraph(containerElement, contacts, options = {}) {
    const { onNodeSelect, onEventSelect, onBackgroundClick } = options;

    // Clear existing graph
    if (graphInstance) {
        graphInstance._destructor();
        graphInstance = null;
    }

    // Prepare graph data
    currentData = prepareGraphData(contacts);

    // Create force graph
    graphInstance = ForceGraph()(containerElement)
        .graphData(currentData)
        .nodeId('id')
        .nodeLabel('label')
        .nodeColor((node) => node.color || '#7b2cbf')
        .nodeRelSize(6)
        .nodeCanvasObject((node, ctx, globalScale) => {
            // Draw node circle
            const size = 12;
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
            ctx.fillStyle = node.color || '#7b2cbf';
            ctx.fill();

            // Draw border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw label inside node
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labelText = node.type === 'event' ? node.label || 'Event' : node.initials || '?';
            const maxTextWidth = size * 1.6;
            let fontSize = node.type === 'event' ? 7 : 9;
            ctx.font = `bold ${fontSize}px sans-serif`;
            while (fontSize > 6 && ctx.measureText(labelText).width > maxTextWidth) {
                fontSize -= 1;
                ctx.font = `bold ${fontSize}px sans-serif`;
            }
            let textToRender = labelText;
            if (ctx.measureText(textToRender).width > maxTextWidth) {
                const trimmed = labelText.slice(0, 10);
                textToRender = trimmed.length < labelText.length ? `${trimmed}…` : trimmed;
            }
            ctx.fillText(textToRender, node.x, node.y);

            // Draw label below node
            if (globalScale > 1.5) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = `${8}px sans-serif`;
                ctx.textBaseline = 'top';
                ctx.fillText(node.label, node.x, node.y + size + 4);
            }
        })
        .nodeCanvasObjectMode(() => 'replace')
        .linkColor(() => 'rgba(255, 255, 255, 0.25)')
        .linkWidth(1.5)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleWidth(1.5)
        .linkDirectionalParticleSpeed(0.004)
        .d3AlphaDecay(0.02)
        .d3VelocityDecay(0.3)
        .cooldownTicks(100)
        .onNodeClick((node) => {
            if (node?.type === 'person' && typeof onNodeSelect === 'function') {
                onNodeSelect(node.data);
                return;
            }
            if (node?.type === 'event' && typeof onEventSelect === 'function') {
                onEventSelect(node.data);
                return;
            }
            if (typeof onBackgroundClick === 'function') {
                onBackgroundClick();
            }
        })
        .onBackgroundClick(() => {
            if (typeof onBackgroundClick === 'function') {
                onBackgroundClick();
            }
        })
        .onNodeHover((node) => {
            containerElement.style.cursor = node ? 'pointer' : 'default';
        });

    // Configure d3 forces separately
    // Keep connected spacing as-is, but pull overall clusters closer to the center.
    graphInstance.d3Force('charge').strength(-70);
    graphInstance.d3Force('collide', forceCollide(9));
    graphInstance.d3Force('x', forceX(0).strength(0.03));
    graphInstance.d3Force('y', forceY(0).strength(0.03));
    const linkForce = graphInstance.d3Force('link');
    if (linkForce) {
        linkForce.distance(40);
    }

    return graphInstance;
}

function prepareGraphData(contacts) {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    const eventMap = new Map();

    // Color palette for person nodes
    const colors = [
        '#7b2cbf', // purple
        '#5a1ea6', // deep purple
        '#ff4d8d', // pink
        '#ff6b4a', // orange
        '#c77dff', // light purple
        '#ff9f1c', // orange
        '#f15bb5', // pink
        '#9d4edd', // purple
    ];

    // Create person nodes
    contacts.forEach((contact, index) => {
        const initials = `${contact.name?.[0] || ''}${contact.surname?.[0] || ''}`.toUpperCase();
        const node = {
            id: `person-${contact.id}`,
            label: `${contact.name} ${contact.surname}`,
            initials: initials || '?',
            color: colors[index % colors.length],
            type: 'person',
            data: contact,
        };
        nodes.push(node);
        nodeMap.set(contact.id, node);
    });

    // Create event nodes and links
    contacts.forEach((contact) => {
        if (contact.source_type === 'event' && contact.source_value) {
            const eventName = contact.source_value;

            // Create event node if doesn't exist
            if (!eventMap.has(eventName)) {
                const eventNode = {
                    id: `event-${eventName}`,
                    label: eventName,
                    initials: 'EV',
                    color: '#ffd166',
                    type: 'event',
                    data: { name: eventName },
                };
                nodes.push(eventNode);
                eventMap.set(eventName, eventNode);
            }

            // Link person to event
            links.push({
                source: `person-${contact.id}`,
                target: `event-${eventName}`,
                id: `link-person-${contact.id}-event-${eventName}`,
            });
        }

        // Link contacts who were introduced by each other (source_type === 'contact')
        if (contact.source_type === 'contact' && contact.source_value) {
            // Try to find the contact by name in source_value
            const introducerName = contact.source_value.toLowerCase();
            contacts.forEach((otherContact) => {
                const fullName = `${otherContact.name} ${otherContact.surname}`.toLowerCase();
                if (otherContact.id !== contact.id && fullName === introducerName) {
                    const linkId = `link-person-${contact.id}-person-${otherContact.id}`;
                    if (!links.find((l) => l.id === linkId)) {
                        links.push({
                            source: `person-${contact.id}`,
                            target: `person-${otherContact.id}`,
                            id: linkId,
                        });
                    }
                }
            });
        }
    });

    return { nodes, links };
}

export function updateGraph(contacts) {
    if (!graphInstance) return;
    currentData = prepareGraphData(contacts);
    graphInstance.graphData(currentData);
}

export function zoomIn() {
    if (!graphInstance) return;
    const currentZoom = graphInstance.zoom();
    graphInstance.zoom(currentZoom * 1.2, 400);
}

export function zoomOut() {
    if (!graphInstance) return;
    const currentZoom = graphInstance.zoom();
    graphInstance.zoom(currentZoom * 0.8, 400);
}

export function resetView() {
    if (!graphInstance) return;
    graphInstance.zoom(1, 400);
    graphInstance.centerAt(0, 0, 400);
}

export function destroyGraph() {
    if (graphInstance) {
        graphInstance._destructor();
        graphInstance = null;
    }
}
