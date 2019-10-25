// Plotting functions

var groupInfo = {};  // populated by setup.js

var Ocean_color = "#81a6d3";
var Ferns_color = "#afa393";
var Tree_color = "#568e14";
var Trees_color = Tree_color;
var Herbs_color = "#ff7f50";
var Unkown_color = "#FF4400";

var groupColors = {
"TRSH": Trees_color,
"HERB": Herbs_color,
"VACR": Ferns_color,
"AQUA": Ocean_color
}

var groupNames = {
"TRSH": "Trees & Shrubs",
"PALM": "Palms",
"MANG": "Mangroves",
"LIAN": "Lianas",
"SUCC": "Succulents",
"HERB": "Herbs",
"VACR": "Ferns",
"AQUA": "Aquatics"
}

//====================================================================

function plotPollen(data, elemId, groupByName="consol_name") {
	/**
	* Plot the pollen percentages of one single sample as a bar diagram.
    *
	* This function takes pollen data, one taxon per element in `data`, and
	* displays it as individual vertical bars. Each element in data must look
	* like
	*
	* ```javascript
	* {
	*     percentage: The percentage of the taxon,
	*     count: The pollen count,
	*     higher_groupid: The group id as defined in the `groupNames` variable,
	*     acc_varname: The accepted variable name,
	*     original_varname: The original variable name as used by the other,
	*     consol_name: The consolidated name (optional),
	* }
	* ```
    *
	* The x-labels of the bars (i.e. the taxa names) are determined by the
	* `groupByName` variable. It must point to one of the properties in the
	* `data` (acc_varname, original_varname, or consol_name) that shall be used
	* for the x-axis. Potential duplicates are summed up.
	*
	* @see plotPollenLegend
    *
	* @param {Array.<Object>} data - The array of taxon percentages
	* @param  {string} elemId - The id where to plot the diagram
	* @param {string} groupByName - The property to use for the x-axis
	*/

    // make the plots
    var plotGroups = ["TRSH", "PALM", "MANG", "LIAN", "SUCC", "HERB", "VACR", "AQUA"];

    data.filter(d => !plotGroups.includes(d.higher_groupid)).forEach(
        function(d) {
            plotGroups.push(d.higher_groupid);
        }
    );

    var groupMap = {};
    plotGroups.forEach(function(key) {
        groupMap[key] = [];
    });

    var percName = groupByName == 'recon_name' ? 'recon_percentage' : 'percentage';

    var counts = {};

    data.filter(d => +d[percName] > 0).forEach(function(d) {
        var name = d[groupByName] ? d[groupByName] : (
            d.consol_name ? d.consol_name : (
                d.acc_varname ? d.acc_varname : d.original_varname));
        d.name = name;
        if (!(name in counts)) {
            counts[name] = {
                percentage: 0,
                name: name, count: 0,
                orig: [], recon: [], acc: [], consol: [], group: []};
            groupMap[d.higher_groupid].push(name);
        }
        counts[name].percentage += +d[percName];
        counts[name].count += d.count;
        if (!(counts[name].orig.includes(d.original_varname))) {
            counts[name].orig.push(d.original_varname);
        }
        if (!(counts[name].recon.includes(d.recon_name))) {
            counts[name].recon.push(d.recon_name);
        }
        if (!(counts[name].consol.includes(d.consol_name))) {
            counts[name].consol.push(d.consol_name);
        }
        if (!(counts[name].acc.includes(d.acc_varname))) {
            counts[name].acc.push(d.acc_varname);
        }
        if (!(counts[name].group.includes(d.higher_groupid))) {
            counts[name].group.push(d.higher_groupid);
        }

    })

    Object.values(groupMap).forEach(function(a) {
        a.sort((a, b) => counts[a].name < counts[b].name ? -1 : 1);
    });

    var plotData = [];
    plotGroups.forEach(function(g) {
        groupMap[g].forEach(function(name) {
            var d = jsonCopy(counts[name]);
            d.group = g;
            plotData.push(d);
        });
    });

    var svg = d3.select("#" + elemId).append("svg"),
        margin = {top: 60, right: 80, bottom: 180, left: 40},
        width = $("#" + elemId).width() - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

    svg
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "0 0 960 240")

    var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(d) {
        meta = counts[d.name];
        return `<strong>${d.name}</strong><br><br>` +
               "<table class='tooltip-table'>" +
               `<tr><td>Original name(s):</td><td>${d.orig.join(', ')}</td></tr>` +
               `<tr><td>Accepted name(s):</td><td>${d.acc.join(', ')}</td></tr>` +
               `<tr><td>Consolidated name(s):</td><td>${d.consol.join(', ')}</td></tr>` +
               `<tr><td>Group: </td><td>${meta.group.join(', ')}</td></tr>` +
               `<tr><td>Percentage: </td><td>${(+d.percentage).toFixed(2)}%</td></tr>` +
               `<tr><td>Counts: </td><td>${d.count}</td></tr>` +
               `</table>`;
    });

    svg.call(tip);

    var nbars = plotData.length;
    var barWidth = width / nbars;
    var barPadding = 4;

    var x = d3.scaleOrdinal().range(Array.from(Array(nbars).keys()).map(function(d) {return (d+1) * barWidth;}));
    var y = d3.scaleLinear().rangeRound([height, 0]);

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var maxPollen = Math.max.apply(Math, plotData.map(d => +d.percentage));

    // to handle duplicated taxa names, we add the `index` to the name. This
    // will be removed later
    x.domain(plotData.map((d, i) => formatNumberLength(i, 2) + d.name));
    y.domain([0, maxPollen]);

    var xAxis = g => g
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .selectAll(".tick text")
            // remove the index (must be called before "wrap")
            .text((name) => name.substr(2))
            .attr("y", "0.15em")
            .attr("x", "-0.8em")
            .call(wrap)
            .attr("transform", "rotate(-65)" )
            .style("text-anchor", "end");

    var yAxis = g => g
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y).ticks(5))
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -30)
        .attr("x", -40)
        .attr("text-anchor", "middle")
        .text("Percentage[%]");

    g.append("g").call(xAxis);

    g.append("g").call(yAxis);

    g.selectAll(".bar")
      .data(plotData)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => y(+d.percentage))
        .attr("width", barWidth - barPadding)
        .attr("height", d => height - y(+d.percentage))
        .style("fill", d => groupColors[d.group] || Unkown_color)
        .attr("transform", (d, i) => `translate(${barWidth * (i + 0.5) + barPadding / 2} , 0)`)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);

    // Exaggerations
    g.append("g")
      .selectAll(".bar")
      .data(plotData)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => y(+d.percentage * 5 < maxPollen ? +d.percentage*5 : 0))
        .attr("width", barWidth - barPadding)
        .attr("height", d => height - y(+d.percentage * 5 < maxPollen ? +d.percentage*5 : 0))
        .style("stroke", d => groupColors[d.group] || Unkown_color)
        .style("stroke-dasharray", ("10,3")) // make the stroke dashed
        .style("fill", "none")
        .attr("transform", (d, i) => `translate(${barWidth * (i + 0.5) + barPadding / 2} , 0)`)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);

    var groups = plotGroups
        .map(g => ( {"key": g, "count": groupMap[g].length} ))
        .filter(d => d.count);

    // groupname bars
    g.append("g")
      .selectAll(".bar")
      .data(groups)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => -margin.top+30)
        .attr("width", function(d, i) { return (d.count) * barWidth; })
        .attr("height", 10)
        .style("fill", function(d) { return groupColors[d.key] || Unkown_color; })
        .attr("data-legend", function(d) { return d.key})
        .attr("transform", function(d, i) {
            var x = 0.5*barWidth + barPadding;
            for ( j = 0; j < i; j++ ) {
                x = x + groups[j].count * barWidth;
            }
            var translate = [x, 0];
            return "translate(" + translate + ")";
        });

}

//====================================================================

function plotPollenLegend(elemId) {
	/**
	* Plot the legend for the pollen diagram
    *
	* @see plotPollen
	*
	* @param  {string} elemId - The id where to plot the diagram
	*/
    var svg = d3.select("#" + elemId).select("svg");

    legendPadding = 10;

    var g = svg.append("g").attr("class", "legend")
            .style("font-size", "18px")
            .attr("transform", "translate(25, 40)");

    var groups = ["TRSH", "HERB", "VACR", "AQUA",
                  "5-times exaggerated"];
    groups.forEach(function(text, i) {
        g.append("text")
            .attr("y", i+"em")
            .attr("x", "1em")
    	    .text(groupNames[text] || text);
        g.append("circle")
            .attr("cy", i-0.25+"em")
            .attr("cx", 0)
            .attr("r", "0.4em")
            .style("fill", groupColors[text] || "none")
            .style("stroke", i == groups.length-1 ? groupColors[groups[0]] : "none")
            .style("stroke-dasharray", i == groups.length-1 ? ("10,3") : "none");
    })

    var lbbox = g.node().getBBox();
    g.append("rect")
        .attr("x",(lbbox.x-legendPadding))
        .attr("y",(lbbox.y-legendPadding))
        .attr("height",(lbbox.height+2*legendPadding))
        .attr("width",(lbbox.width+2*legendPadding))
        .style("fill", "none")
        .style("stroke", "black");
}

// ==================================================================

function plotClimate(data, elemId) {
	/**
	* Plot the monthly and seasonal climate for a sample
    *
	* This function plots the monthly, seasonal and annual tmperature and
	* precipitation of the samples. The given `data` must hold a
	* `Precipitation` and `Temperature` property that is used for the
	* plotting.
	*
	* @see plotClimateLegend
    *
	* @param {Object} data - The meta data with a Precipitation and Temperature property
	* @param  {string} elemId - The id where to plot the diagram
	*/

    var precip = data.Precipitation.slice(),
        temperature = data.Temperature;

    for (i = 12; i < monthsSeasons.length; i++) {
        if (isNaN(precip[i])) {
            // do nothing
        } else if (i < monthsSeasons.length - 1) {
            precip[i] = precip[i] > 0 ? precip[i] / 3. : precip[i]
        } else {
            precip[i] = precip[i] > 0 ? precip[i] / 12. : precip[i]
        }
    }

    var svg = d3.select("#" + elemId).append("svg"),
        margin = {top: 40, right: 80, bottom: 180, left: 40},
        width = $("#" + elemId).width() - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

    svg
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "0 0 960 240")

    var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html((d, i) => "<table class='tooltip-table'>" +
                      `<tr><td>Precipitation:</td><td>${Math.round(precip[i]*100)/100} mm/month</td></tr>` +
                      `<tr><td>Temperature:</td><td>${Math.round(temperature[i]*100)/100} ºC</td></tr>` +
                      `</table>`
                  );

    svg.call(tip);

    var nbars = precip.length;
    var barWidth = width / nbars;
    var barPadding = 4;

    var x = d3.scaleOrdinal().range(Array.from(Array(nbars).keys()).map(function(d) {return d * barWidth;})),
        y = d3.scaleLinear().rangeRound([height, 0]),
        y2 = d3.scaleLinear().rangeRound([height, 0]);

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var title = g.append("text")
        .attr("dx", (width / 2))
        .attr("y", -margin.top+20)
        .attr("text-anchor", "middle")
        .attr("class", "title")
        .text(title);

    var maxTemp = Math.max.apply(Math, temperature);
    var minTemp = Math.min.apply(Math, temperature);
    var maxPrecip = Math.max.apply(Math, precip);

    x.domain(monthsSeasons);
    y.domain([minTemp, maxTemp]);
    y2.domain([0, maxPrecip])

    var temperatureLine = d3.line()
        .x(function(d, i) {return x(i) + barWidth / 2})
        .y(function(d, i) {return y(d)})

    var xAxis = g => g
        .attr("class", "axis axis--x")
        .attr("transform", "translate(" + (barWidth / 2) +  "," + height + ")")
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .selectAll("text")
            .style("text-anchor", "middle");

    var yAxis = g => g
        .attr("class", "axis axis--y")
        // .attr("transform", "translate(0" + width + " ,0)")
        .call(d3.axisLeft(y).ticks(5))
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -30)
        .attr("x", -40)
        .attr("text-anchor", "middle")
        .text("Temperature [ºC]");

    var yAxis2 = g => g
        .attr("class", "axis axis--y")
        .attr("transform", "translate(" + width + " ,0)")
        .call(d3.axisRight(y2).ticks(5))
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 40)
        .attr("x", -30)
        .attr("text-anchor", "middle")
        .text("Precipitation [mm/month]");

    g.append("g").call(xAxis);
    g.append("g").call(yAxis);
    g.append("g").call(yAxis2);

    g.selectAll(".bar")
      .data(precip)
      .enter().append("rect")
        .attr("class", "bar")
        // .attr("x", function(d) { return x(d); })
        .attr("y", d => y2(d))
        .attr("width", barWidth - barPadding)
        .attr("height", d => height - y2(d))
        .style("fill", "steelblue")
        .attr("transform", function (d, i) {
             var translate = [barWidth * i + barPadding / 2 , 0];
             return "translate("+ translate +")";})
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);

    g.append("path")        // Add the temperature path.
        .style("stroke", "FireBrick")
        .style("fill", "none")
        .attr('stroke-width', 2)
        .attr("d", temperatureLine(temperature))
        .attr("transform", function (d, i) {
             var translate = [barWidth * i + barPadding , 0];
             return "translate("+ translate +")";
        });

    // vertical line to separate months and seasons
    g.append("line")
        .attr("x1", x(12))
        .attr("y1", 0)
        .attr("x2", x(12))
        .attr("y2", 300 - margin.top - margin.bottom)
        .style("stroke-dasharray", ("3, 3"))
        .style("stroke-width", 2)
        .style("stroke", "black")
        .style("fill", "none");

}

//====================================================================

function plotClimateLegend(elemId) {
	/**
	* Plot the climate legend
	*
	* @see plotClimate
    *
	* @param  {string} elemId - The id where to plot the legend
	*/
    var svg = d3.select("#" + elemId).select("svg");

    legendPadding = 10;

    var g = svg.append("g").attr("class", "legend")
            .style("font-size", "18px")
            .attr("transform", "translate(25, 40)");

    g.append("text")
        .attr("y", 0)
        .attr("x", "1em")
        .text("Precipitation");
    g.append("circle")
        .attr("cy", -0.25+"em")
        .attr("cx", 0)
        .attr("r", "0.4em")
        .style("fill", "steelblue");

    g.append("text")
        .attr("y", "1em")
        .attr("x", "1em")
        .text("Temperature");
    g.append("line")
        .attr("x1", 0)
        .attr("x2", "1em")
        .attr("y1", "0.75em")
        .attr("y2", "0.75em")
        .style("stroke", "FireBrick")
        .attr('stroke-width', 2);

    var lbbox = g.node().getBBox();
    g.append("rect")
        .attr("x",(lbbox.x-legendPadding))
        .attr("y",(lbbox.y-legendPadding))
        .attr("height",(lbbox.height+2*legendPadding))
        .attr("width",(lbbox.width+2*legendPadding))
        .style("fill", "none")
        .style("stroke", "black");
}

//====================================================================

function plotSamplesPerMill(data, elemId) {
    //graph code
    var svg = d3.select("#" + elemId).select("svg"),
        margin = {top: 20, right: 20, bottom: 30, left: 40},
        width = datesGraphWidth - margin.left - margin.right,
        height = datesGraphHeight - margin.top - margin.bottom;

    var x = d3.scaleOrdinal()
        .range(Array.from(Array(13).keys()).map(
            function(d) {return d * width / 13;})),
        y = d3.scaleLinear()
            .rangeRound([height, 0]);

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var barWidth = (width / (data.length + 1));
    var barPadding = 4;
    var maxHeight = Math.max.apply(Math, data);

    x.domain(['0k', '1k', '2k', '3k', '4k', '5k', '6k', '7k', '8k', '9k',
              '10k', '11k', '12k']);
    y.domain([0, maxHeight]);

    var xAxis = g => g
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .append("text")
            .attr("y", margin.bottom)
            .attr("x", width / 2)
            .attr("text-anchor", "middle")
            .text("cal BP");

    var yAxis = g => g
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y).ticks(5))
        .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -30)
            .attr("x", -margin.left)
            .attr("text-anchor", "middle")
            .text("#Samples");

    g.append("g").call(xAxis);
    g.append("g").call(yAxis);

    g.selectAll(".bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "bar")
        // .attr("x", function(d) { return x(d); })
        .attr("y", d => y(d))
        .attr("width", barWidth - barPadding)
        .attr("height", d => height - y(d))
        .style("fill", "steelblue")
        .attr("transform", function (d, i) {
            var translate = [barWidth * i + barPadding / 2 , 0];
            return "translate("+ translate +")";
        });
}


//====================================================================

function plotPollenDiagram(data, elemId, groupByName="consol_name") {

    if (elemId == "") return;

    var groupMap = {};
    Object.keys(groupInfo).forEach(function(key) {
        groupMap[key] = [];
    });

    var percName = groupByName == 'recon_name' ? 'recon_percentage' : 'percentage';

    var counts = {};
    // first loop: Create empty config for all taxa
    var firstAge = data[0].age;
    var allAges = [];
    var allSamples = [];
    var sampleAges = [];
    data.filter(d => +d[percName] > 0).forEach(function(d) {
        if (!(allSamples.includes(d.sample_))) {
            allSamples.push(d.sample_);
            sampleAges.push({age: d.age, sample: d.sample_})
        }
    });

    sampleAges.sort((d1, d2) => d1.age - d2.age);
    var allAges = sampleAges.map(d => d.age);
    var allSamples = sampleAges.map(d => d.sample);

    zeros = new Array(sampleAges.length).fill(0);

    data.filter(d => +d[percName] > 0).forEach(function(d){
        // Use the original_varname here because it is unique (acc_varname is not)
        var name = d[groupByName] ? d[groupByName] : (
            d.consol_name ? d.consol_name : (
                d.acc_varname ? d.acc_varname : d.original_varname));
        d.name = name;
        if (!(name in counts)) {
            counts[name] = {
                x: zeros.slice(), y: allAges,
                name: name, count: zeros.slice(),
                orig: [], recon: [], acc: [], consol: [], group: []};
            groupMap[d.higher_groupid].push(name);
        }
        counts[name].x[allSamples.indexOf(d.sample_)] += d[percName];
        counts[name].count[allSamples.indexOf(d.sample_)] += d.count;
        if (!(counts[name].orig.includes(d.original_varname))) {
            counts[name].orig.push(d.original_varname);
        }
        if (!(counts[name].recon.includes(d.recon_name))) {
            counts[name].recon.push(d.recon_name);
        }
        if (!(counts[name].consol.includes(d.consol_name))) {
            counts[name].consol.push(d.consol_name);
        }
        if (!(counts[name].acc.includes(d.acc_varname))) {
            counts[name].acc.push(d.acc_varname);
        }
        if (!(counts[name].group.includes(d.higher_groupid))) {
            counts[name].group.push(d.higher_groupid);
        }

    })

    var minAge = Math.round(Math.min.apply(null, allAges));
    var maxAge = Math.round(Math.max.apply(null, allAges));

    // round to closest 50ies
    minAge -= ((50 - ((minAge < 0 ? -minAge : 50 - minAge) % 50)) % 50);
    maxAge += ((50 - ((maxAge < 0 ? 50 + maxAge : maxAge) % 50)) % 50);

    Object.values(groupMap).forEach(function(a) {
        a.sort((a, b) => counts[a].name < counts[b].name ? -1 : 1);
    });

    // now estimate the width for each subplot
    var maxX = {};
    var totalX = 0;
    var exclude = [];  // taxa that will not be plotted because always smaller than 1%
    Object.keys(counts).forEach(function(key) {
        maxX[key] = Math.max.apply(null, counts[key].x);
        if (maxX[key] < 1.0) {
            exclude.push(key);
        } else {
            maxX[key] = Math.round(Math.max(20., maxX[key]));
            maxX[key] += (5 - (maxX[key] % 5)) % 5;
            totalX += maxX[key];
        }
    });

    var widths = {};
    Object.keys(maxX).forEach(function(key) {
        widths[key] = maxX[key] / totalX;
    });

    var margin = {top: 180, right: 80, bottom: 60, left: 50},
        fullWidth = $("#" + elemId).width() - margin.left - margin.right,
        height = 600 - margin.top - margin.bottom;

    // make the plots
    var plotGroups = ["TRSH", "PALM", "MANG", "LIAN", "SUCC", "HERB", "VACR", "AQUA"];

    Object.keys(groupMap).filter(key => !plotGroups.includes(key)).forEach(
        function(key) {
            plotGroups.push(key);
        }
    );

    var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(data) {
        var name = data[0].name;
        var maxPerc = Math.max.apply(null, counts[name].x);
        var maxDate = counts[name].y[counts[name].x.indexOf(maxPerc)];
        var totalCounts = counts[name].count.reduce((a, b) => a + b);
        var meta = counts[name];
        return `<strong>${name}</strong><br><br>` +
               "<table class='tooltip-table'>" +
               `<tr><td>Original name(s):</td><td>${meta.orig.join(', ')}</td></tr>` +
               `<tr><td>Accepted name(s):</td><td>${meta.acc.join(', ')}</td></tr>` +
               `<tr><td>Consolidated name(s):</td><td>${meta.consol.join(', ')}</td></tr>` +
               `<tr><td>Name(s) for reconstruction:</td><td>${meta.recon.join(', ')}</td></tr>` +
               `<tr><td>Group: </td><td>${meta.group.join(', ')}</td></tr>` +
               `<tr><td>max. Percentage: </td><td>${maxPerc.toFixed(2)}% at ${maxDate} yr BP</td></tr>` +
               `<tr><td>Total Counts: </td><td>${totalCounts}</td></tr></table>`;
    });

    var first = true;
    plotGroups.forEach(function(group) {
        groupMap[group].filter(name => !exclude.includes(name)).forEach(function(name, i) {
            taxon_data = []
            counts[name].x.forEach(function(val, i) {
                taxon_data.push({x: val, y: counts[name].y[i],
                                 name: counts[name].name});
            });
            var width = fullWidth * widths[name];

            var x = d3.scaleLinear().rangeRound([0, width]);
            var y = d3.scaleLinear().rangeRound([0, height]);
            x.domain([0, maxX[name]]);
            y.domain([minAge, maxAge]);

            var ticks = arange(5, parseInt(maxX[name]), 10)

            var svg = d3.select("#" + elemId).append("svg")
                .attr("width", width + (first ? margin.left : 0))
                .attr("height", height + margin.top + margin.bottom);

            var g = svg.append("g")
                .attr("transform", `translate(${first ? margin.left : 0}, ${margin.top})`);

            svg.call(tip);

            g.append("text")
                .text(counts[name].name)
                .attr("class", "title")
                .attr("dy", (width / 2))
                .attr("dx", "1em")
                .style("text-anchor", "start")
                .attr("transform", "rotate(-90)");

            var xAxis = g => g
                .attr("class", "axis axis--x")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x).tickValues(ticks))

            var yAxis = g => g
                .attr("class", "axis axis--y")
                .call(d3.axisLeft(y).ticks(5))
              .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", -margin.left + 10)
                .attr("x", -parseInt(height / 2))
                .attr("text-anchor", "middle")
                .text("Year BP");

            g.append("g").call(xAxis);

            g.append("g").call(yAxis);

            var area = d3.area()
                .x1(d => x(d.x))
                .x0(d => x(0))
                .y(d => y(d.y));

            g.append("path")
                .datum(taxon_data)
                .attr("class", "area")
                .style("stroke", "none")
                .attr("fill", groupColors[group] || Unkown_color)
                .style("fill-opacity", 1.0)
                .attr("d", area)
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide);

            var exag = d3.line()
                .x(d => x(d.x * 5))
                .y(d => y(d.y));

            g.append("path")
                .datum(taxon_data)
                .style("stroke", groupColors[group] || Unkown_color)
                .attr('stroke-width', 2)
                .style("stroke-dasharray", ("3, 5"))
                .attr("fill", "none")
                .attr("d", exag)
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide);
            first = false;
        });
    });
}

function plotPollenLegend(elemId) {
    var svg = d3.select("#" + elemId).select("svg");

    legendPadding = 10;

    var g = svg.append("g").attr("class", "legend")
            .style("font-size", "18px")
            .attr("transform", "translate(25, 40)");

    var groups = ["TRSH", "HERB", "VACR", "AQUA",
                  "5-times exaggerated"];
    groups.forEach(function(text, i) {
        g.append("text")
            .attr("y", i+"em")
            .attr("x", "1em")
    	    .text(groupNames[text] || text);
        g.append("circle")
            .attr("cy", i-0.25+"em")
            .attr("cx", 0)
            .attr("r", "0.4em")
            .style("fill", groupColors[text] || "none")
            .style("stroke", i == groups.length-1 ? groupColors[groups[0]] : "none")
            .style("stroke-dasharray", i == groups.length-1 ? ("10,3") : "none");
    })

    var lbbox = g.node().getBBox();
    g.append("rect")
        .attr("x",(lbbox.x-legendPadding))
        .attr("y",(lbbox.y-legendPadding))
        .attr("height",(lbbox.height+2*legendPadding))
        .attr("width",(lbbox.width+2*legendPadding))
        .style("fill", "none")
        .style("stroke", "black");
}

//====================================================================

function getNamesMenu(elemId, entity, fossil=true) {
    var menuDiv = d3.select("#" + elemId + "-title").append("select")
        .attr("id", elemId + '-name')
        .on('change', function() {
            document.getElementById(elemId).innerHTML = "";
            if (fossil) {
                var idx = diagramTypeMenu.property("value");
                if (idx == "all") {
                    plotPollenDiagram(plottedPollenData[entity], elemId, this.value);
                } else {
                    plotPollen(
                        plottedPollenData[entity].filter(
                            d => d.sample_ == parseInt(idx)), elemId, this.value);
                }
            } else {
                plotPollen(plottedPollenData[entity], elemId, this.value);
            }
        });

    menuDiv.append("option")
        .attr("value", "original_varname")
        .html("Original names");

    menuDiv.append("option")
        .attr("value", "acc_varname")
        .html("Accepted names");

    menuDiv.append("option")
        .attr("value", "consol_name")
        .html("Consolidated names")
        .attr("selected", true);

    menuDiv.append("option")
        .attr("value", "recon_name")
        .html("Reconstruction names");

    if (fossil) {
        var diagramTypeMenu = d3.select("#" + elemId + "-title").append("select")
            .attr("id", elemId + '-type')
            .on('change', function() {
                document.getElementById(elemId).innerHTML = "";
                if (this.value == "all") {
                    plotPollenDiagram(plottedPollenData[entity], elemId,
                        menuDiv.property("value"));
                } else {
                    plotPollen(plottedPollenData[entity].filter(
                            d => d.sample_ == parseInt(this.value)), elemId,
                            menuDiv.property("value"));

                }
            });

        diagramTypeMenu.append("option")
            .attr("value", "all")
            .attr("selected", true)
            .html("All data");

        var ages = plottedPollenData[entity].map(d => d.age);
        ages.sort((a, b) => a - b);

        ages.forEach(function(a, i) {
            diagramTypeMenu.append("option")
                .attr("value", i + 1)
                .html(`Sample ${i+1} at ${a} cal BP`);
        })
    }
}


//====================================================================


function isVisible(variable, seriesName, what="mean") {
    var config = visibleReconstructions[variable][seriesName];
    return config.mean && config[what]
}


function getUncertaintyName(variable, seriesName, what="lower") {
    return $(`#recon-${variable}-config-${seriesName}-${what}`).attr("value")
}


function resolveReconstruction(variable, seriesName, data, config) {
    var ret = {}
    ret.y = +data[config.name];
    ret.x = +data[config.index];
    ret.uncertainties = [];
    if (isVisible(variable, seriesName, "lower") |
            isVisible(variable, seriesName, "upper")) {
        if (isVisible(variable, seriesName, "lower")) {
            var uncName = getUncertaintyName(variable, seriesName, "lower");
            if (config.upper.includes(uncName)) {
                ret.uncertainties.push(ret.y - (+data[uncName]))
            } else {
                ret.uncertainties.push(+data[uncName])
            }
        } else {
            ret.uncertainties.push(ret.y)
        }
        if (isVisible(variable, seriesName, "upper")) {
            var uncName = getUncertaintyName(variable, seriesName, "upper");
            if (config.lower.includes(uncName)) {
                ret.uncertainties.push(ret.y + (+data[uncName]))
            } else {
                ret.uncertainties.push(+data[uncName])
            }
        } else {
            ret.uncertainties.push(ret.y)
        }
    }
    return ret
}

function plotReconstructions(variable, recons, elemId) {

    // make the plot
    var margin = {top: 5, right: 80, bottom: 70, left: 70},
        width = $("#" + elemId).width() - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

    var svg = d3.select("#" + elemId).append("svg")
        .attr("width", width + margin.left)
        .attr("height", height + margin.top + margin.bottom);

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var domains = getDomains(variable, recons);

    var x = d3.scaleLinear().rangeRound([0, width]).domain(domains.x);
    var y = d3.scaleLinear().rangeRound([height, 0]).domain(domains.y);

    var xAxis = g => g
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .append("text")
            .attr("y", margin.bottom / 2)
            .attr("x", width / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .text(recons.index_desc);

    var yAxis = g => g
        .call(d3.axisLeft(y).ticks(5))
        .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left / 2)
            .attr("x", -parseInt(height / 2))
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .text(`${recons.desc} [${recons.units}]`);

    g.append("g")
        .attr("class", "x axis")
        .call(xAxis);

    g.append("g")
        .attr("class", "y axis")
        .call(yAxis);

    var colors = [];
    var gs = [];

    recons.plotComponents = {
        svg: g,
        xAxis: xAxis,
        yAxis: yAxis,
        x: x,
        y: y
    };

    Object.keys(recons.series)
        .filter(seriesName => isVisible(variable, seriesName))
        .forEach(function(seriesName) {

            var seriesData = recons.series[seriesName]

            seriesData.line = d3.line()
                .x(d => x(d.x))
                .y(d => y(d.y));

            seriesData.uncertainty_plot = d3.area()
                .x(d => x(d.x))
                .y0(d => y(d.uncertainties[0]))
                .y1(d => y(d.uncertainties[1]));

            plotLine(seriesData, g)

    })
}

function plotLine(seriesData, g) {
    var seriesG = g.append("g").datum(seriesData.plot_data);

    seriesG.append("path")
        .style("stroke", seriesData.color)
        .style("fill", "none")
        .attr('stroke-width', 2)
        .attr("d", seriesData.line);

    var plotUncertanties = (seriesData.plot_data[0].uncertainties.length > 0);

    if (plotUncertanties) {

        seriesG.append('path')
            .attr("class", "area")
            .style("stroke", "none")
            .attr("fill", seriesData.color)
            .style("fill-opacity", 0.25)
            .attr('d', seriesData.uncertainty_plot);
    }
    seriesData.svg = seriesG;
}


function getDomains(variable, recons) {
    var allAges = [];
    var allRanges = [];

    Object.keys(recons.series).forEach(function(s) {
        var data = recons.series[s];
        data.plot_data = [];
        data.data.forEach(function(d) {
            var plot_data = resolveReconstruction(variable, s, d, data);
            data.plot_data.push(plot_data);
            allAges.push(plot_data.x);
            allRanges.push(plot_data.y);
            allRanges.push.apply(allRanges, plot_data.uncertainties);
        })
    })

    // select min and max age for the plot
    var minAge = Math.round(Math.min.apply(null, allAges));
    var maxAge = Math.round(Math.max.apply(null, allAges));

    // round to closest 50ies
    minAge -= ((50 - ((minAge < 0 ? -minAge : 50 - minAge) % 50)) % 50);
    maxAge += ((50 - ((maxAge < 0 ? 50 + maxAge : maxAge) % 50)) % 50);

    // select min and max climate for the plot
    var minTemp = Math.round(Math.min.apply(null, allRanges));
    var maxTemp = Math.round(Math.max.apply(null, allRanges));

    // round to closest 5
    minTemp -= ((5 - ((minTemp < 0 ? -minTemp : 5 - minTemp) % 5)) % 5);
    maxTemp += ((5 - ((maxTemp < 0 ? 5 + maxTemp : maxTemp) % 5)) % 5);

    return {x: [minAge, maxAge], y: [minTemp, maxTemp]}
}


function updateLine(variable, seriesName, action) {
    var config = visibleReconstructions[variable][seriesName];

    if (action == "toggle-lower") config.lower = !config.lower;
    if (action == "toggle-upper") config.upper = !config.upper;

    if (action == "toggle") config.mean = !config.mean;
    Object.keys(plottedReconstructions).forEach(function (entity) {

        if (document.getElementById(`recon-diagram-${entity}-title`) != null) {

            var variableConf = plottedReconstructions[entity][variable];
            var components = variableConf.plotComponents;

            domains = getDomains(variable, variableConf);

            components.x.domain(domains.x);
            components.y.domain(domains.y);
            components.svg.select(".x.axis")
                .call(components.xAxis);
            components.svg.select(".y.axis")
                .call(components.yAxis);


            // replot all lines because the limits might have changed
            Object.keys(variableConf.series).forEach(function (seriesName) {
                var seriesData = variableConf.series[seriesName];
                if (typeof(seriesData.svg) !== "undefined") {
                    seriesData.svg.remove();
                    delete seriesData.svg;
                }

                if (isVisible(variable, seriesName)) {
                    plotLine(seriesData, variableConf.plotComponents.svg);
                }
            })
        }
    })
}
