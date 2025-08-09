<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8" />
    <title>Tidy Tree</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
        body {
            margin: 0;
            font: 14px/1.4 system-ui, sans-serif;
        }

        #topbar {
            padding: 10px 14px;
            border-bottom: 1px solid #ddd;
            display: flex;
            gap: 12px;
            align-items: center;
        }

        #chart {
            width: 100vw;
            height: calc(100vh - 48px);
        }

        svg {
            width: 100vw;
            height: 100vh;
            display: block;
        }

        .link {
            fill: none;
            stroke: #ccc;
            stroke-width: 1.5px;
        }

        .node circle {
            r: 5;
            cursor: pointer;
            stroke: #333;
            stroke-width: 1px;
            fill: #fff;
        }

        .node text {
            font-size: 12px;
            dominant-baseline: middle;
        }

        .tooltip {
            position: fixed;
            pointer-events: auto;
            background: #fff;
            border: 1px solid #ddd;
            padding: 8px 10px;
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, .08);
            max-width: 320px;
            font-size: 13px;
            z-index: 1000;
        }

        .popup-help {
            position: fixed;
            pointer-events: auto;
            background: #fff;
            border: 1px solid #ddd;
            padding: 8px 10px;
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, .08);
            max-width: 320px;
            font-size: 13px;
            z-index: 1001;
        }
    </style>
</head>

<body>
    <div id="topbar">
        <strong>Tidy Tree</strong>
        <label><input type="checkbox" id="wrap"> Wrap labels</label>
        <label>Node size: <input type="range" id="nodesize" min="20" max="220" value="120"></label>
        <button id="collapseAll">Collapse All</button>
        <button id="expandAll">Expand All</button>
    </div>
    <div id="chart"></div>

    <!-- D3 v7 -->
    <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
    <script>
        async function init() {
            let response = await fetch('ResurrectionDisciplesBelievedItActs01.json');
            let data = await response.json();

            // === 2) Basic settings ===
            const container = document.getElementById('chart');
            const width = container.clientWidth;
            const height = container.clientHeight;

            const svg = d3.select("#chart").append("svg")
                .attr("width", width).attr("height", height);

            const g = svg.append("g"); // for zoom/pan

            const zoom = d3.zoom().scaleExtent([0.4, 2.5]).on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
            svg.call(zoom);

            const tooltip = d3.select("body").append("div")
                .attr("class", "tooltip").style("opacity", 0);
            // Add a separate popup help element
            const popupHelp = d3.select("body").append("div")
                .attr("class", "popup-help").style("opacity", 0).style("position", "fixed");

            // Collapsible tree helpers
            function collapse(d) {
                if (d.children) { d._children = d.children; d._children.forEach(collapse); d.children = null; }
            }
            function expand(d) {
                if (d._children) { d.children = d._children; d._children = null; }
            }

            const root = d3.hierarchy(data);
            root.x0 = height / 2;
            root.y0 = 0;
            root.children && root.children.forEach(collapse); // start collapsed

            const tree = d3.tree().nodeSize([120, 200]); // vertical spacing, horizontal spacing

            // Controls
            const nodeSizeInput = document.getElementById('nodesize');
            nodeSizeInput.addEventListener('input', () => {
                const v = +nodeSizeInput.value;
                tree.nodeSize([v, v + 80]);
                update(root);
            });
            const wrapToggle = document.getElementById('wrap');

            // Word wrap helper
            function wrapText(selection, width = 160) {
                selection.each(function (d) {
                    const text = d3.select(this);
                    const words = (text.text() || "").split(/\s+/).reverse();
                    let line = [], lineNumber = 0;
                    // Set x based on node type
                    const x = (d.children || d._children) ? -10 : 10;
                    let tspan = text.text(null).append("tspan").attr("x", x).attr("dy", "0em");
                    let word, lineHeight = 1.1;
                    while (word = words.pop()) {
                        line.push(word);
                        tspan.text(line.join(" "));
                        if (tspan.node().getComputedTextLength() > width) {
                            line.pop();
                            tspan.text(line.join(" "));
                            line = [word];
                            tspan = text.append("tspan")
                                .attr("x", x)
                                .attr("dy", ++lineNumber * lineHeight + "em")
                                .text(word);
                        }
                    }
                });
            }

            // Color per node (inherit from ancestors if not set)
            function nodeColor(d) {
                let x = d;
                while (x) {
                    if (x.data && x.data.color) return x.data.color;
                    x = x.parent;
                }
                return "#6c6c6c";
            }

            function update(source) {
                tree(root);
                const nodes = root.descendants();
                const links = root.links();

                nodes.forEach(d => d.y = d.depth * 180); // horizontal spacing per depth

                // LINKS
                const link = g.selectAll("path.link").data(links, d => d.target.id || (d.target.id = crypto.randomUUID()));
                link.enter().append("path")
                    .attr("class", "link")
                    .attr("d", d3.linkHorizontal().x(d => source.y0).y(d => source.x0))
                    .merge(link)
                    .transition().duration(350)
                    .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x));
                link.exit().transition().duration(250)
                    .attr("d", d3.linkHorizontal().x(d => source.y).y(d => source.x))
                    .remove();

                // NODES
                const node = g.selectAll("g.node").data(nodes, d => d.id || (d.id = crypto.randomUUID()));

                const nodeEnter = node.enter().append("g")
                    .attr("class", "node")
                    .attr("transform", d => `translate(${source.y0},${source.x0})`)
                    .on("click", (event, d) => {
                        if (!d.children && !d._children && d.data.source && d.data.source.url) {
                            // Build popup HTML
                            let html = `<strong>${d.data.name}</strong>`;
                            if (d.data.details) html += `<div style='margin-top:6px;'>${d.data.details}</div>`;
                            html += `<div style='margin-top:10px;'><a href='${d.data.source.url}' target='_blank' style='color:blue;text-decoration:underline;'>${d.data.source.title || "View Source"}</a></div>`;
                            popupHelp.html(html)
                                .style("opacity", 1)
                                .style("pointer-events", "auto")
                                .style("left", (event.clientX + 24) + "px")
                                .style("top", (event.clientY + 24) + "px");
                            // Attach named outside click handler in capture phase for reliability
                            setTimeout(() => {
                                document.addEventListener('mousedown', popupHelpOutsideClickHandler, true);
                            }, 0);
                        } else {
                            d.children ? collapse(d) : expand(d);
                            update(d);
                            popupHelp.style("opacity", 0); // Hide popup help when expanding/collapsing
                            document.removeEventListener('mousedown', popupHelpOutsideClickHandler, true);
                        }
                    })
                    .on("mouseenter", (event, d) => {
                        const txt = d.data.subtitle || "";
                        if (!txt) return;
                        tooltip.html(txt)
                            .style("opacity", 1)
                            .style("pointer-events", "none")
                            .style("left", (event.clientX + 24) + "px")
                            .style("top", (event.clientY + 24) + "px");
                    })
                    .on("mousemove", (event) => {
                        tooltip.style("left", (event.clientX + 24) + "px")
                            .style("top", (event.clientY + 24) + "px");
                    })
                    .on("mouseleave", () => {
                        tooltip.style("opacity", 0);
                    });
                // Remove mouseleave handler so tooltip doesn't disappear immediately

                // Helper to hide popup help only when clicking outside
                function popupHelpOutsideClickHandler(e) {
                    const popupEl = popupHelp.node();
                    // Only dismiss if popup is visible and click is outside
                    if (popupHelp.style("opacity") === "1" && (!popupEl || (e.target !== popupEl && !popupEl.contains(e.target)))) {
                        popupHelp.style("opacity", 0);
                        document.removeEventListener('mousedown', popupHelpOutsideClickHandler, true);
                    }
                }

                nodeEnter.append("circle")
                    .attr("r", 1e-6)
                    .attr("fill", d => (d._children ? nodeColor(d) : "#fff"))
                    .attr("stroke", d => nodeColor(d));

                const labels = nodeEnter.append("text")
                    .attr("dy", "0em")
                    .attr("x", d => (d.children || d._children) ? -10 : 10)
                    .attr("text-anchor", d => (d.children || d._children) ? "end" : "start")
                    .html(d => d.data.link
                        ? `<a href="${d.data.link}" target="_blank" style="fill:blue;text-decoration:underline">${d.data.name}</a>`
                        : d.data.name);

                function applyLabelWrapping() {
                    g.selectAll("g.node text").each(function (d) {
                        const text = d3.select(this);
                        text.text(d.data.name);
                        if (wrapToggle.checked) wrapText(text, 160);
                    });
                }
                applyLabelWrapping();
                wrapToggle.onchange = applyLabelWrapping;

                // UPDATE + TRANSITIONS
                const nodeUpdate = nodeEnter.merge(node);
                nodeUpdate.transition().duration(350)
                    .attr("transform", d => `translate(${d.y},${d.x})`);
                nodeUpdate.select("circle").transition().duration(350)
                    .attr("r", 6)
                    .attr("fill", d => (d._children ? nodeColor(d) : "#fff"))
                    .attr("stroke", d => nodeColor(d));
                nodeUpdate.select("text").transition().duration(350)
                    .attr("x", d => (d.children || d._children) ? -10 : 10)
                    .attr("text-anchor", d => (d.children || d._children) ? "end" : "start");

                const nodeExit = node.exit().transition().duration(250)
                    .attr("transform", d => `translate(${source.y},${source.x})`)
                    .remove();
                nodeExit.select("circle").attr("r", 1e-6);

                // Stash positions for smooth transitions next time
                nodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });
            }

            update(root);

            // Center root nicely
            svg.call(zoom.transform, d3.zoomIdentity.translate(60, height / 2).scale(1));

            // Collapse or expand all nodes
            function collapseAll(d) {
                if (d.children) {
                    d.children.forEach(collapseAll);
                    collapse(d);
                }
            }
            function expandAll(d) {
                if (d._children) {
                    expand(d);
                    d.children.forEach(expandAll);
                } else if (d.children) {
                    d.children.forEach(expandAll);
                }
            }

            document.getElementById('collapseAll').onclick = () => {
                root.children && root.children.forEach(collapseAll);
                update(root);
            };
            document.getElementById('expandAll').onclick = () => {
                root.children && root.children.forEach(expandAll);
                update(root);
            };
        }

        init();
    </script>
</body>

</html>