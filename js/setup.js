//====================================================================

var theMap;
var mapMaxZoom = 15;

var xf;

var countryDim,
    continentDim,
    originDim,
    nsamplesDim,
    ageDim,
    checkBoxDim,
    tableDim;

var dataTable,
    // formatted meta data table
    formattedDataTable,
    // leaflet map
    mapChart,
    // country selection menu
    countryMenu,
    // continent selection menu
    continentMenu,
    // entity origin chart
    originChart,
    // fossil, modern, ... checkboxes
    checkBoxMenu;

// all charts except the map
var allCharts;

var diagramJSON;

var groupInfo = {};

// The initial center for the map
var mapCenter = [45, -20],
    mapZoom = 3;

var datesGraphWidth = 250;
var datesGraphHeight = 120;

var displayedId = -1;

// The meta data of the last displayed sample
var displayedData = {};

var nsamplesRange = [0., 200.],
    nsamplesBinWidth = 10.;

var age1Range = [-2.5, 12000.],
    age2Range = [-2.5, 12000.],
    ageBinWidth = 100;

// The path to the marker
var imgMarker = 'img/marker.png',
    imgMarkerHighlight = 'img/marker_highlight.png';

var Ocean_color = "#81a6d3";
var Ferns_color = "#afa393";
var Tree_color = "#568e14";
var Trees_color = Tree_color;
var Herbs_color = "#ff7f50";
var Unkown_color = "#FF4400";

// URL for the neotoma explorer
var NEOTOMAURL = "http://apps.neotomadb.org/explorer";

// An array that includes the overlays that are about to being plotted at
// the moment to avoid parallel plotting of the same Overlay
var plottingOverlay = [];

// The configuration of displaying the timeseries of reconstructions
var reconConfig = {};

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

var Set1 = [
    // colors used for reconstructions
    "#377eb8",  // blue
    "#ff7f00",  // orange
    "#4daf4a",  // green
    "#e41a1c",  // red
    "#984ea3"   // purple
]

var metaData;

var dataVersion = "fossil";  // stable, latest or custum

var baseUrl, urlFossil, urlCalib, urlAll;

var defaultEditorProperties = {"Id": {"type": "integer", "required": true}}

var diagramJSON = {};

// All markers on the map
var mapMarkers = {};

var urlParams, entityParams;

// Query parameters
var user_commit, user_branch, user_repo, user_meta_file;

// data specifiers
var repo_url = 'data/',
    meta_file = 'fossil.tsv',
    data_repo = 'Chilipp/POLNET-data';

// Pollen data that has been plotted
var plottedPollenData = {};

// plotted site-based climate reconstructions
var plottedReconstructions = {};
var visibleReconstructions = {};

dc.config.defaultColors(d3.schemeRdBu[11])

//====================================================================
$(document).ready(function() {

  if (window.getComputedStyle($("#mobile-alert")[0]).display  == "none") {
      $("#alerts").remove();
  }

    //-----------------------------------
    // setup the version buttons and get the url for the EMPD-data
    urlParams = new URLSearchParams(window.location.search);
    user_commit = urlParams.get('commit');
    user_branch = urlParams.get('branch');
    user_repo = urlParams.get('repo');
    user_meta_file = urlParams.get('meta');

    data_repo = user_repo ? user_repo : 'Chilipp/POLNET-data';
    meta_file = user_meta_file ? user_meta_file : meta_file

    entityParams = urlParams.getAll('entities');
    if (entityParams) urlParams.delete('entities');

    data_repo = user_repo ? user_repo : 'Chilipp/POLNET-data';
    meta_file = user_meta_file ? user_meta_file : meta_file

    if (user_commit) {
        repo_url = 'https://raw.githubusercontent.com/' + data_repo + '/' + user_commit + '/';
        user_branch = 'master';
    } else if (user_branch) {
        repo_url = 'https://raw.githubusercontent.com/' + data_repo + '/' + user_branch + '/';
    } else if (user_repo) {
        user_branch = 'master';
        repo_url = 'https://raw.githubusercontent.com/' + data_repo + '/' + user_branch + '/';
    } else {
        repo_url = 'data/';
        user_branch = 'master';
    }

    //-----------------------------------
    // load the meta data
    d3.tsv(repo_url + meta_file, parseMeta).then(function(data){
        metaData = data;
        // fill the groupInfo
        d3.tsv(
            repo_url + 'groupid.tsv', function (d) {
                groupInfo[d.groupid] = d

                if (typeof(groupNames[d.groupid]) == "undefined") {
                    groupNames[d.groupid] = d.groupname;
                }
                return d;
            });

        // initialize the cross filter
        initCrossfilter(data);

        //-----------------------------------
        // Setup some controls for the map
        theMap = mapChart.map();

        // zoom home button
        L.easyButton('glyphicon-home', function(btn, map){
            map.setView(mapCenter, mapZoom);
        }, "Zoom home").addTo(theMap);

        mapmadeUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        mapmade = new L.TileLayer(mapmadeUrl, { maxZoom: mapMaxZoom+1});

        // minimap
        new L.Control.MiniMap(mapmade, { toggleDisplay: true, zoomLevelOffset: -4 }).addTo(theMap);

        // mouse position label to display latitude and longitude of the cursor
        new L.Control.MousePosition({
            lngFirst: true,
            position: "topright",
            numDigits: 2
        }).addTo(theMap);

        //----------------------------------------------------------------
        // Events handling for download management
        $('#button_cartadd').click(function() {
          	selection = tableDim.top(Infinity);
                selection.forEach(function(d) {
            data[d.Id -1].Selected = true;
        	});
                formattedDataTable.redraw();
                dataTable.redraw();
            });

        $('#button_cartdelete').click(function() {
            data.forEach(function(d,i) { d.Selected = false; });
            formattedDataTable.redraw();
            dataTable.redraw();
        });

        $("#button_share").mouseover(function() {
            var selected = data.filter(d => d.Selected).map(d => d.e_);
            var nbSelection = selected.length
            var permaLink = baseUrl + "?";
            if (urlParams.toString()) permaLink += urlParams.toString() + "&";

            permaLink += "entities=" + selected.join(',');

            $('#button_share').prop(
                'title',
                'Copy the URL for the selected entities to the clipboard ' +
                `(currently ${nbSelection} item${nbSelection > 1 ? 's' : ''})`
            );
            $('#button_share').prop("href", permaLink);

        })

        $('#button_shipping').mouseover(function() {
            var nbSelection = data.filter(d => d.Selected).length
            downloadType = document.getElementById("download-type").value;
            $('#button_shipping').prop(
                'title',
                `Deliver ${downloadType} of cart as tab-separated file ` +
                `(currently ${nbSelection} item${nbSelection > 1 ? 's' : ''})`
            );
        });

        $("#button_shipping").click(function() {

            var downloadType = document.getElementById("download-type").value;

            if (downloadType == "data") {
                var entities = []
                data.forEach(function(d) {if (d.Selected == true) entities.push(d.e_);});

            function ignoreError(task, callback) {
                task(function(error, result) {
                    if (error) console.error(error);
                    return callback(null, result); // ignore error, e.g. 404-ing
                });
            }

            var promises = [];

            entities.forEach(function(entity) {promises.push(d3.tsv(
                repo_url + 'entities/' + entity + '.tsv',
                function(d) {d.e_ = entity; return d;}))
        });

            Promise.all(promises).then(function(data) { downloadJSON(data.flat(), 'data.tsv')});
         } else {
            downloadJSON(data.filter(function(d){return d.Selected == true}), 'metadata.tsv')
         }

        });


        // plot the pollen and climate data on popupopen
        theMap.on('popupopen', function(event) {
            Id = event.popup._source.key[2] - 1;
            displaySampleData(data[Id]);
        })

        theMap.on('popupclose', function(event) {
            Id = event.popup._source.key[2] - 1;
            displayedId = -1;
            displayedData = {};
            highlightDisplayed();
        });

        ['chart-table', 'formatted-chart-table'].forEach(function(tableId) {
            // Add ellipses for long entries and make DOI a hyperlink to google scholar
            $('#' + tableId).on('mouseover', '.dc-table-column', function() {
              // displays popup only if text does not fit in col width
              if (this.offsetWidth < this.scrollWidth) {
                d3.select(this).attr('title', d3.select(this).text());
              }
            });

            // Make DOI a hyperlink to google scholar and handle selection
            $('#' + tableId).on('click', '.dc-table-column', function() {
              column = d3.select(this).attr("class");
              if (column == "dc-table-column _0") {
                  Id = d3.select(this.parentNode).select(".dc-table-column._1").text();
                 	data[Id-1].Selected = d3.select(this).select('input').property('checked');
              } else {
                  Id = d3.select(this.parentNode).select(".dc-table-column._1").text();
              	  dataTable.filter(Id);
              	  dc.redrawAll();
              	  // make reset link visible
                  d3.select("#resetFormattedTableLink").style("display", "inline");
                  d3.select("#resetTableLink").style("display", "inline");
              }
            });
        });

        markers = mapChart.markerGroup();
        markers.on('clustermouseover', function (a) {
            childMarkers = a.layer.getAllChildMarkers();
            childMarkersIds = childMarkers.map(function(obj) {return obj.key[2]}).sort();

            if ($('#meta-table').hasClass("active")) {
              childMarkersIds.forEach(function(Id, i) {
              	d3.selectAll(".dc-table-column._1")
              		.text(function (d) {
              	     		if (parseInt(d.Id) == Id) {
              				if (i==0) this.parentNode.scrollIntoView();  // scroll for first
              	                 	d3.select(this.parentNode).style("font-weight", "bold");
                            document.getElementById('wrap').scrollIntoView();
              	               	}
              	     		return d.Id;
                      	});
              });
            };
        });
        markers.on('clustermouseout', function (a) {
            highlightDisplayed();
        });

        $.getJSON("data/recon/reconstructions.json").done(function(data) {
            reconConfig = data;
            createReconConfig(data);
          return data;
        })

        // $.getJSON("data/overlays/overlays.json").done(function(data) {
        //     overlays = data;
        //   Object.keys(overlays).forEach(createOverlayDiv);
        //   return data;
        // })

        if (entityParams.length) {
            var entities = entityParams
                .map(s => s.split(',')).flat()
                .map(v => parseInt(v));
            tableDim.filter(v => entities.includes(v));
            dc.redrawAll();
        }

    });

    // Switch to a tab if a specific one is mentiond
    var activeTab = urlParams.get('tab');
    if (activeTab) {
        $(`#meta-tabs a[href="#${activeTab}"]`).tab('show');
        document.getElementById(activeTab).scrollIntoView();
    }

});

// ==================================================================

function createReconConfig(config) {
    // Create the configuration of reconstruction configuration
    var configDiv = document.getElementById("recon-config-tabs");
    Object.keys(config).forEach(function (variable) {
        var variableConf = config[variable];
        var iColor = 0;
        configDiv.innerHTML += (
            `<div class="panel panel-default">
                <div class="panel-heading" role="tab" id="recon-${variable}-heading">
                    <h4 class="panel-title">
                        <a role="button" data-toggle="collapse" data-parent="#recon-${variable}-config" href="#recon-${variable}-config" aria-expanded="false" aria-controls="recon-${variable}-config">
                            ${variableConf.desc}
                        </a>
                    </h4>
                </div>
                <div id="recon-${variable}-config" class="panel-collapse collapse" role="tabpanel" aria-labelledby="recon-${variable}-heading">
                    <div class="panel-body" id="recon-${variable}-config-body">
                    </div>
                </div>
            </div>`
        );
        var varConfigDiv = document.getElementById(`recon-${variable}-config-body`);
        visibleReconstructions[variable] = {};
        Object.keys(variableConf['series']).forEach(function (seriesName) {
            var seriesConf = variableConf.series[seriesName]

            // set the color for the reconstruction
            seriesConf['color'] = Set1[iColor];

            varConfigDiv.innerHTML += (
                `<button role="button" type="button" class="btn active" data-toggle="button" aria-pressed="true" autocomplete="off" id="recon-${variable}-config-${seriesName}-lower-toggle" title="Hide the lower uncertainty range" onclick="updateLine('${variable}', '${seriesName}', 'toggle-lower')"><span class="glyphicon glyphicon-eye-open" aria-hidden="true"></span></button>
                <div class="btn-group">
                    <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" id="recon-${variable}-config-${seriesName}-lower" value="${seriesConf.lower[0]}">
                        ${seriesConf.desc_lower[0]} <span class="caret"></span>
                    </button>
                    <ul class="dropdown-menu" id="recon-${variable}-config-${seriesName}-lower-list">
                    </ul>
                </div>
                <button type="button" class="btn active" data-toggle="button" aria-pressed="true" autocomplete="off" title="Hide the ${seriesConf.desc} in the diagrams" id="recon-${variable}-config-${seriesName}-mean-toggle" onclick="updateLine('${variable}', '${seriesName}', 'toggle')">${seriesConf.desc}</button>
                <div class="btn-group">
                    <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" id="recon-${variable}-config-${seriesName}-upper"  value="${seriesConf.upper[0]}">
                    ${seriesConf.desc_upper[0]} <span class="caret"></span>
                    </button>
                    <ul class="dropdown-menu" id="recon-${variable}-config-${seriesName}-upper-list">
                    </ul>
                </div>
                <button role="button" type="button" class="btn active" data-toggle="button" aria-pressed="false" autocomplete="off" id="recon-${variable}-config-${seriesName}-upper-toggle" title="Hide the upper uncertainty range" onclick="updateLine('${variable}', '${seriesName}', 'toggle-upper')"><span class="glyphicon glyphicon-eye-open" aria-hidden="true"></span></button>
                <br>`
            );
            var lowerId = `recon-${variable}-config-${seriesName}-lower`,
                upperId = `recon-${variable}-config-${seriesName}-upper`;
            var lowerMenu = document.getElementById(`${lowerId}-list`);
            var upperMenu = document.getElementById(`${upperId}-list`);
            seriesConf.desc_lower.forEach(function (s, i) {
                lowerMenu.innerHTML += `<li><a href="javascript:setUncertainty('${lowerId}', '${seriesConf.lower[i]}', '${s}', '${variable}', '${seriesName}');">${s}</a></li>`;
            });
            seriesConf.desc_upper.forEach(function (s, i) {
                upperMenu.innerHTML += `<li><a href="javascript:setUncertainty('${upperId}', '${seriesConf.upper[i]}', '${s}', '${variable}', '${seriesName}');">${s}</a></li>`;
            });

            visibleReconstructions[variable][seriesName] = {
                "mean": true,
                "lower": true,
                "upper": true
            }

            var limits = ["upper", "lower"];

            limits.forEach(function (s) {
                $(document).on('click', `#recon-${variable}-config-${seriesName}-${s}-toggle`, function() {
                    var btn = $(`#recon-${variable}-config-${seriesName}-${s}-toggle`);
                    if (btn.hasClass("active")) {
                        btn.html('<span class="glyphicon glyphicon-eye-open" aria-hidden="true"></span>');
                        btn.attr("title", `Hide the ${s} uncertainty range`);
                    } else {
                        btn.html('<span class="glyphicon glyphicon-eye-close" aria-hidden="true"></span>');
                        btn.attr("title", `Show the ${s} uncertainty range`);
                    }
                });
            });
            iColor = iColor + 1;
        });
    });
}

function setUncertainty(elemId, value, desc, variable, seriesName) {
    document.getElementById(elemId).innerHTML = desc + ' <span class="caret"></span>';
    $("#" + elemId).attr("value", value)
    updateLine(variable, seriesName, "replot")
}

// ==================================================================

function parseMeta(d, i) {
    d.e_ = +d.e_;
    d.Id = i+1;
    d.londd = +d.londd;
    d.latdd = +d.latdd;
    d.nsamples12k = +d.nsamples12k
    d.youngest = +d.youngest;
    d.oldest12k = +d.oldest12k;
    if (typeof(d.sample_dates.replace) !== 'undefined') {
        d.sample_dates = $.map(d.sample_dates.slice(1, -1).split(","), v => parseInt(v) || 0);
    };

    if (typeof(d.original_e_) == 'undefined') {
        d.original_e_ = '';
    }

    d.Selected = false;
    d.Edited = false;

    if (typeof(d.ismodern) !== typeof(true)) {
        d.ismodern = d.ismodern.toLowerCase().startsWith('f') ? false : true;
    };

    if (typeof(d.isdigitized) !== typeof(true)) {
        d.isdigitized = d.isdigitized.toLowerCase().startsWith('f') ? false : true;
    };

  // Limit latitudes according to latitude map range (-85:85)
    if (d.latdd < -85) d.latdd = -85;
    if (d.latdd > 85) d.latdd = 85;
    for (var key in d) {
        d[key] = typeof d[key] !== 'undefined' ? d[key] : '';
    }
    return d;
}

// ==================================================================

function displaySampleData(data) {
    displayedId = data.Id;
    displayedData = data;
    highlightDisplayed();

    var activeTab = $('#recon-plot').hasClass("active") ? "recon-plot" : "pollen-plot";
    removeUnlocked();
    document.getElementById("pollen-diagram-legend").innerHTML = "<svg/>";

    if (!data.ismodern) plotSamplesPerMill(data.sample_dates, "datesgraph-" + data.Id);

    var promises = [];

    // load site reconstructions
    var reconData = jsonCopy(reconConfig);

    Object.keys(reconData).forEach(function (key) {
        var series = reconData[key]['series'];
        Object.keys(series).forEach(function (series_name) {
            var series_conf = series[series_name]
            series_conf['data'] = [];

            var data_url = repo_url + `recon/${key}/${series_name}/${data.e_}.tsv`

            promises.push(d3.tsv(
                data_url,
                function (d) {
                    series_conf['data'].push(d);
                }
            ).catch(function(reason){
                console.log(`Error when loading ${data_url}. ` +
                            `No ${series_name} reconstruction of ${key} ` +
                            `available for ${data.e_}: ${reason}`);
                return [];
            }));
        });
    });

    // Add pollen data
    promises.push(d3.tsv(
        repo_url + 'entities/' + data.e_ + '.tsv',
        function(d) {
            d.higher_groupid = groupInfo[d.groupid].higher_groupid;
            d.percentage = d.percentage == '' ? NaN : +d.percentage;
            d.recon_percentage = d.recon_percentage == '' ? NaN : +d.recon_percentage;
            d.count = d.count == '' ? NaN : +d.count;
            d.e_ = data.e_;
            d.age = (d.age == '' || d.age.toLowerCase() == 'nan') ? NaN : +d.age;
            return d
        }).catch(function(reason){
            console.log(`No pollen data available for ${data.e_}: ${reason}`);
            return [];})
    );

    Promise.all(promises).then(function(entityData) {
        var pollenData = entityData.pop();
        if (pollenData.length > 0) {
            var elemId = lockableElement("pollen-diagram", data.e_, data.sitename);
            $('#meta-tabs a[href="#pollen-plot"]').tab('show');
            if (displayedData.nsamples12k == 1) {
                pollenData = pollenData.filter(d => !isNaN(d.percentage));
                plotPollen(pollenData, elemId);
            } else {
                pollenData = pollenData.filter(d => !isNaN(d.percentage) && !isNaN(d.age));
                plotPollenDiagram(pollenData, elemId);
            }
            plottedPollenData[data.e_] = pollenData;
            getNamesMenu(elemId, data.e_);
            plotPollenLegend('pollen-diagram-legend');
            $("#pollen-info").remove()
        }

        var elemId = lockableElement("recon-diagram", data.e_, data.sitename);

        Object.keys(reconData).forEach(function (variable) {
            $('#meta-tabs a[href="#recon-plot"]').tab('show');
            if (Object.keys(reconData[variable].series).some(seriesName => isVisible(variable, seriesName) && (reconData[variable].series[seriesName].data.length > 0))) {
                d3.select("#" + elemId).append("div")
                    .attr("id", elemId + "-" + variable)
                    .attr("width", "100%");
                plotReconstructions(
                    variable, reconData[variable], elemId + "-" + variable)
                $("#recon-info").remove()
            }
        })
        plottedReconstructions[data.e_] = reconData;

        $('#meta-tabs a[href="#' + activeTab + '"]').tab('show');
    })
};

// ==================================================================

function getPopupContent(data) {
    /**
    * Get the popup content for one meta data row
    *
    * @param {Object} data - The meta data row
    *
    * @return {string} The popupcontent for the map
    */
    if (data.origin == 'NEOTOMA') {
        let url = NEOTOMAURL + '?datasetid=' + data.original_e_;
        var orig_e = `<a href="${url}" target="_blank" title="View in the Neotoma Explorer">(${data.original_e_})</a>`;
    } else {
        var orig_e = data.original_e_ ? `(${data.original_e_})` : '';
    }
    var permaLink = baseUrl + "?";
    if (urlParams.toString()) permaLink += urlParams.toString() + "&";
    permaLink += "entities=" + data.e_;
    return (`<div class="container" style="width:${data.nsamples12k < 2  ? 300 : 300 + datesGraphWidth}px">`
            + "<div class=row>"
            + (data.ismodern ? "" : "<div class='col-xs-6'>")
            + `Entity: <b>${data.e_}</b></br>`
            + `<b>${data.poldiv1} (${data.poldiv0})</b></br></br>`
            + `Position: <b>${data.londd.toFixed(2)} °E</b>, <b>${data.latdd.toFixed(2)} °N</b></br>`
            + `Elevation: <b>${data.elevation}</b> m a.s.l.</br>`
            + `Source: <b>${data.origin}</b> ${orig_e}</br>`
            + `Name: <b>${data.sitename}</b></br>`
            + (data.ismodern ? "<span style='color: #ff6961;'><b>modern sample</b></span></br>" :
               `Date (cal BP): <span style='color: #C9840B;'>`
               + `from <b>${data.youngest.toFixed(2)}</b> to <b>${data.oldest12k.toFixed(2)}</b></span></br>`
               + `# Samples: <b>${data.nsamples12k}</b></br>`
               + `# Chronology points: <b>${data.selected_nchronpoints}</b></br>`)
            + (data.isdigitized ? "<span style='color: #ff6961;'><b>digitized</b></span></br>" : "</br>")
            + (data.nsamples12k < 2 ? "" : `</div><div class='col-xs-6'><div id='datesgraph-${data.Id}' style='width:${datesGraphWidth}px; height:${datesGraphHeight}px;'><svg/></div></div>`)
            + "</div>"
            + "<div class=row>"
            + `<a class="btn pull-right" title="Permalink to this entitity" target="_blank" href="${permaLink}"><img src="img/share.png" style="height:30px;"></a>`
            + '<input class="btn pull-right" type="image" src="img/cartadd.png" title="Add this sample to the download cart" onclick="javascript:displayedData.Selected=true;formattedDataTable.redraw();dataTable.redraw();" style="height:40px;">'
            + "</div>"
            + '</div>');
    }

//====================================================================
// Paging functions for dataTable. Taken from
// http://dc-js.github.io/dc.js/examples/table-pagination.html
// on December, 4th 2018
var ofs = 0, pag = 100;

function update_offset() {
    var totFilteredRecs = xf.groupAll().value();
    var end = ofs + pag > totFilteredRecs ? totFilteredRecs : ofs + pag;
    ofs = ofs >= totFilteredRecs ? Math.floor((totFilteredRecs - 1) / pag) * pag : ofs;
    ofs = ofs < 0 ? 0 : ofs;
    dataTable.beginSlice(ofs);
    formattedDataTable.beginSlice(ofs);
    dataTable.endSlice(ofs+pag);
    formattedDataTable.endSlice(ofs+pag);
}
function display_page_buttons() {
    var totFilteredRecs = xf.groupAll().value();
    var end = ofs + pag > totFilteredRecs ? totFilteredRecs : ofs + pag;
    d3.select('#begin')
        .text(end === 0? ofs : ofs + 1);
    d3.select('#begin-formatted')
        .text(end === 0? ofs : ofs + 1);
    d3.select('#end')
        .text(end);
    d3.select('#end-formatted')
        .text(end);
    d3.select('#prev-table-page')
        .attr('disabled', ofs-pag<0 ? 'true' : null);
    d3.select('#prev-formatted-table-page')
        .attr('disabled', ofs-pag<0 ? 'true' : null);
    d3.select('#next-table-page')
        .attr('disabled', ofs+pag>=totFilteredRecs ? 'true' : null);
    d3.select('#next-formatted-table-page')
        .attr('disabled', ofs+pag>=totFilteredRecs ? 'true' : null);
    d3.select('#size').text(totFilteredRecs);
    d3.select('#size-formatted').text(totFilteredRecs);
    if(totFilteredRecs != xf.size()){
        d3.select('#totalsize').text("(filtered Total: " + xf.size() + " )");
        d3.select('#totalsize-formatted').text("(filtered Total: " + xf.size() + " )");
    }else{
        d3.select('#totalsize').text('');
        d3.select('#totalsize-formatted').text('');
    }
}
function next_table_page() {
    ofs += pag;
    update_offset();
    dataTable.redraw();
    formattedDataTable.redraw();
}
function prev_table_page() {
    ofs -= pag;
    update_offset();
    dataTable.redraw();
    formattedDataTable.redraw();
}

//====================================================================
function initCrossfilter(data) {
    // initialize the crossfilter and setup the dimensions and charts

    //-----------------------------------
    xf = crossfilter(data);

    //-----------------------------------
    countryDim = xf.dimension(d => d.poldiv1);

    //-----------------------------------
    continentDim = xf.dimension(d => d.poldiv0);

    //-----------------------------------
    originDim = xf.dimension(d => d.origin);

    //-----------------------------------
    nsamplesDim = xf.dimension( function(d) {
        // Threshold
        var nsamplesThresholded = d.nsamples12k;
        if (d.ismodern && d.nsamples12k == 1) return -1;  // exclude surface samples
            if (nsamplesThresholded <= nsamplesRange[0]) nsamplesThresholded = nsamplesRange[0];
            if (nsamplesThresholded >= nsamplesRange[1]) nsamplesThresholded = nsamplesRange[1] - nsamplesBinWidth;
            return nsamplesBinWidth*Math.floor(nsamplesThresholded/nsamplesBinWidth);
    });

    //-----------------------------------
    ageDim = xf.dimension( function(d) {
        // Threshold
        var age1Thresholded = d.youngest;
        if (age1Thresholded <= age1Range[0]) age1Thresholded = age1Range[0];
        if (age1Thresholded >= age1Range[1]) age1Thresholded = age1Range[1] - ageBinWidth;
        var age1 = ageBinWidth*Math.floor(age1Thresholded/ageBinWidth);
        var age2Thresholded = d.oldest12k;
        if (age2Thresholded <= age2Range[0]) age2Thresholded = age2Range[0];
        if (age2Thresholded >= age2Range[1]) age2Thresholded = age2Range[1] - ageBinWidth;
        var age2 = ageBinWidth*Math.floor(age2Thresholded/ageBinWidth);
        return [age1, age2, d.origin];
    });

    //-----------------------------------
    checkBoxDim = xf.dimension(function(d) {
        var ret = [];
        if (d.ismodern) {
            ret.push("modern surface samples");
        } else {
            ret.push("fossil sites")
        };
        if (d.isdigitized) ret.push("digitized sites/samples");
        if (d.ismodern && d.nsamples12k > 1) ret.push("modern sites");
        return ret;
    }, true);

    //-----------------------------------
    mapDim = xf.dimension(d => [d.latdd, d.londd, d.Id]);
    mapGroup = mapDim.group();

    //-----------------------------------
    tableDim = xf.dimension(d => d.e_);

    //-----------------------------------

    customMarker = L.Marker.extend({
    options: {
        Id: 'Custom data!'
    },
    setOpacity: function(opacity) {}  // disables changes in opacity
    });

    iconSize = [32,32];
    iconAnchor = [16,32];
    popupAnchor = [0,-32];

    mapChart = dc_leaflet.markerChart("#chart-map");

    mapChart
        .width($("#chart-map").width())
        .height(400)
        .dimension(mapDim)
        .group(mapGroup)
        .center(mapCenter)
        .zoom(mapZoom)
        .tiles(function(map) {			// overwrite default baselayer
	   return L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
                { attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community' }).addTo(map);
        })
        .mapOptions({maxZoom: mapMaxZoom, zoomControl: true})
        // .fitOnRender(false)
        .filterByArea(true)
        .cluster(true)
        .clusterOptions({maxClusterRadius: 50, showCoverageOnHover: false, spiderfyOnMaxZoom: true})
        .title(function() {})
        .popup(function(d,marker) {
            Id = d.key[2] -1;
            popup = L.popup({autoPan: false, closeButton: false, maxWidth: 600});
            popup.setContent(getPopupContent(data[Id]));
                mapMarkers[Id] = marker;

            return popup;
        })
        .marker(function(d,map) {
            var Id = d.key[2] -1;
            var icon = L.icon({
                iconSize: iconSize, iconAnchor: iconAnchor,
                popupAnchor: popupAnchor, iconUrl: imgMarker });

            marker = new customMarker([data[Id].latdd, data[Id].londd], {Id: (Id+1).toString(), icon: icon});
            marker.on('mouseover', function(e) {
                iconUrlNew = imgMarkerHighlight;
                iconNew = L.icon({ iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor, iconUrl: iconUrlNew });
                e.target.setIcon(iconNew);
                d3.selectAll(".dc-table-column._1")
                    .text(function (d, i) {
                        if (parseInt(d.Id) == e.target.options.Id) {
                            if ($('#meta-table').hasClass("active")) {
                                $('#meta-tabs a[href="#meta-table"]').tab('show');
        						this.parentNode.scrollIntoView();
			                 	d3.select(this.parentNode).style("font-weight", "bold");
                                document.getElementById('wrap').scrollIntoView();
                            }
		               	}
			     		return d.Id;
		        	});
		});
            marker.on('mouseout', function(e) {
                iconUrlNew = imgMarker;
                iconNew = L.icon({ iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor, iconUrl: iconUrlNew });
                e.target.setIcon(iconNew);
                highlightDisplayed();
                });
            return marker;
        });

    //-----------------------------------
    dataCount = dc.dataCount('#chart-count');

    dataCount
        .dimension(xf)
        .group(xf.groupAll())
        .html({
            some: '<strong>%filter-count</strong> selected out of <strong>%total-count</strong> records' +
                ' | <a href=\'javascript: resetAll_exceptMap();\'>Reset All</a>',
            all: `All <strong>%total-count</strong> records selected. Please click on the map or <a href="javascript:showFilters()">here</a> to apply filters.`
        });

    //-----------------------------------
    dataTable = dc.dataTable("#chart-table");

    var  all_columns = Object.keys(data[0]);
    var exclude = ["Selected", "Id", "Edited"];

    var columns = all_columns.filter(s => exclude.indexOf(s) === -1);

    var colFuncs = [
        d => d.Selected ? "<input type='checkbox' checked>" : "<input type='checkbox'>",
        d => d.Id,
    ];

    columns.forEach(function(column) {
          document.getElementById("meta-table-head").innerHTML += (
              '<th class="th_MetaColumn">' + column + '</th>'
          )
          if (column.search("DOI") !== -1) {
              colFuncs.push(function (d) {return DOILink(d[column]);});
          } else if (column.search("Email") !== -1) {
              colFuncs.push(function(d) {return mailLink(d.SampleName, d[column], d[column]);});
          } else {
              colFuncs.push(function(d) {return d[column];});
          };
    });

    dataTable
    .dimension(tableDim)
    .group(function(d) {})
    .showGroups(false)
    .size(Infinity)
    .columns(colFuncs)
    .sortBy(function(d){ return +d.Id; })
    .order(d3.ascending)
    .on('preRender', update_offset)
    .on('preRedraw', update_offset)
    .on('pretransition', display_page_buttons);

    //-----------------------------------
    formattedDataTable = dc.dataTable("#formatted-chart-table");

    formattedDataTable
    .dimension(tableDim)
    .group(function(d) {})
    .showGroups(false)
    .size(Infinity)
    .columns([
        d => d.Selected ? "<input type='checkbox' checked>" : "<input type='checkbox'>",
        d => d.Id,
    ])
    .sortBy(function(d){ return +d.Id; })
    .order(d3.ascending)
    .on('preRender', update_offset)
    .on('preRedraw', update_offset)
    .on('pretransition', display_page_buttons);

    //-----------------------------------
    var originColors = d3.scaleOrdinal()
      .domain(["BINNEY", "POLARVE eur3", "EMBSECBIO", "NEOTOMA", "EMPD", "EPD", "ACER database", "Unknown"])
      .range(["#e34a33", Ocean_color, Ferns_color, Tree_color, Herbs_color, Ferns_color, Ferns_color, Unkown_color]);   // http://colorbrewer2.org/

    originChart  = dc.rowChart("#origin-chart");

    originChart
      .width(180)
      .margins({top: 10, right: 10, bottom: 30, left: 10})
      .dimension(originDim)
      .group(originDim.group())
      .colors(originColors)
      .elasticX(true)
      .gap(2)
      .xAxis().ticks(4);

    //-----------------------------------

    countryMenu = dc.selectMenu('#country-filter')
        .dimension(countryDim)
        .group(countryDim.group())
        .multiple(true)
        .numberVisible(10)
        .controlsUseVisibility(true);

    //-----------------------------------

    continentMenu = dc.selectMenu('#continent-filter')
        .dimension(continentDim)
        .group(continentDim.group())
        .multiple(true)
        .numberVisible(10)
        .controlsUseVisibility(true);

    //-----------------------------------
    nsamplesChart  = dc.barChart("#nsamples-chart");

    nsamplesChart
        .width(300)
        .height(200)
        .margins({top: 10, right: 20, bottom: 30, left: 40})
        .centerBar(false)
        .xAxisLabel("Number of samples")
        .yAxisLabel("Entities")
        .elasticY(true)
        .dimension(nsamplesDim)
        .group(nsamplesDim.group())
        .x(d3.scaleLinear().domain(nsamplesRange))
        .xUnits(dc.units.fp.precision(nsamplesBinWidth))
        .round(function(d) {return nsamplesBinWidth*Math.floor(d/nsamplesBinWidth)})
        .gap(0)
        .renderHorizontalGridLines(true)
        .colors(Ocean_color);

    //-----------------------------------
    ageChart  = dc.scatterPlot("#age-chart");

    ageChart
        .width(250)
        .height(180)
        .margins({top: 10, right: 20, bottom: 30, left: 40})
        .dimension(ageDim)
        .group(ageDim.group())
        .xAxisLabel("Most recent age [yr BP]")
        .yAxisLabel("Oldest age [yr BP]")
        //.mouseZoomable(true)
        .x(d3.scaleLinear().domain(age1Range))
        .y(d3.scaleLinear().domain(age2Range))
        .round(function(d) {return ageBinWidth*Math.floor(d/ageBinWidth)})
        .renderHorizontalGridLines(true)
        .renderVerticalGridLines(true)
        .symbolSize(8)
        .excludedSize(4)
        .existenceAccessor(function(d) { return d.value > 0 ; })
        .colorAccessor(function (d) { return d.key[2]; })
        .colors(originColors)
        .filterHandler(function(dim, filters) {
            if(!filters || !filters.length) {
                dim.filter(null);
            } else {
                // assume it's one RangedTwoDimensionalFilter
                dim.filterFunction(function(d) {
                    return filters[0].isFiltered([d[0],d[1]]);
                })
            }
         });


    xAxis_ageChart = ageChart.xAxis();
    xAxis_ageChart.ticks(6).tickFormat(d3.format("d"));
    yAxis_ageChart = ageChart.yAxis();
    yAxis_ageChart.ticks(6).tickFormat(d3.format("d"));

    //-----------------------------------

    checkBoxMenu = dc.cboxMenu("#checkbox-filter")
        .dimension(checkBoxDim)
        .group(checkBoxDim.group())
        .multiple(true);

    allCharts = [
        dataTable, formattedDataTable, originChart, countryMenu,
        continentMenu, nsamplesChart, checkBoxMenu
    ];

    //-----------------------------------
    dc.renderAll();
}

// ====================================
// Functions to reset the cross filter

function resetData(data) {
    // remove the data and add it again

    xf.remove(function(d, i) {return d.Id === data.Id;});
    xf.add([data]);

    dataTable.sortBy(d => +d.Id);
    formattedDataTable.sortBy(d => +d.Id);

    dc.redrawAll();
}

function showFilters() {
    $('#meta-tabs a[href="#filters-tab"]').tab('show');
    document.getElementById('filters-tab').scrollIntoView();
}

// reset dataTable
function resetTable() {
    dataTable.filterAll();
    dc.redrawAll();
    // make reset link invisible
    d3.select("#resetFormattedTableLink").style("display", "none");
    d3.select("#resetTableLink").style("display", "none");
}

// reset all except mapChart
function resetAll_exceptMap() {
    allCharts.slice(1).forEach(function(chart) {chart.filterAll();});
    resetTable();
    dc.redrawAll();
}

//====================================================================
