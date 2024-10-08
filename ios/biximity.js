// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: magic;

let language = "english";
if (
    args &&
    args.widgetParameter &&
    args.widgetParameter.toLowerCase().startsWith("fr")
) {
    language = "french";
}

const text = {
    english: {
        disclaimer: null,
        updatedAt: "Updated at",
    },
    french: {
        disclaimer: null,
        updatedAt: "Mis à jour à",
    },
};

const STYLE = {
    bodyPadding: 8,
    stationPadding: 4,
    valueStackSize: new Size(22, 0),
};

let stations;
try {
    stations = await bixiAPI();
    saveStations(stations);
} catch (e) {
    stations = getSavedStations();
    if (stations === null) {
        throw new Error("Could not fetch stations");
    }
    text.english.disclaimer = "No internet connection";
    text.french.disclaimer = "Pas de connexion internet";
}

const globalFont = new Font("normal", 16);

let widget = await createWidget(stations);
if (config.runsInWidget) {
    Script.setWidget(widget);
} else {
    widget.presentMedium();
}
Script.complete();

async function createWidget(stations) {
    let widget = new ListWidget();

    let gradient = new LinearGradient();
    gradient.locations = [0, 1];
    gradient.colors = [new Color("2B2D42"), new Color("03045E")];
    widget.backgroundGradient = gradient;

    let headerStack = widget.addStack();

    try {
        let appIcon = await loadAppIcon();
        let appIconElement = headerStack.addImage(appIcon);
        appIconElement.imageSize = new Size(33, 10);
        appIconElement.cornerRadius = 4;
    } catch {
        let appIcon = SFSymbol.named("wifi.slash").image;
        let appIconElement = headerStack.addImage(appIcon);
        appIconElement.imageSize = new Size(16, 16);
        appIconElement.tintColor = Color.red();
    }

    headerStack.addSpacer();
    headerStack.centerAlignContent();
    let bikeHeaderStack = headerStack.addStack();
    bikeHeaderStack.size = STYLE.valueStackSize;
    let bikeSymbol = SFSymbol.named("bicycle");
    let image = bikeHeaderStack.addImage(bikeSymbol.image);
    image.imageSize = new Size(16, 16);
    image.tintColor = Color.green();

    let ebikeHeaderStack = headerStack.addStack();
    ebikeHeaderStack.size = STYLE.valueStackSize;
    let ebikeSymbol = SFSymbol.named("bolt.fill");
    image = ebikeHeaderStack.addImage(ebikeSymbol.image);
    image.imageSize = new Size(16, 16);
    image.tintColor = Color.blue();

    let dockStack = headerStack.addStack();
    dockStack.size = STYLE.valueStackSize;
    let dockSymbol = SFSymbol.named("equal.circle");
    image = dockStack.addImage(dockSymbol.image);
    image.imageSize = new Size(16, 16);
    image.tintColor = Color.white();

    widget.addSpacer(STYLE.bodyPadding);

    for (const station of stations) {
        let stationStack = widget.addStack();

        let distanceStack = stationStack.addStack();
        distanceStack.centerAlignContent();
        let distanceElement = distanceStack.addText(
            createDistanceString(station.distance)
        );
        distanceElement.textColor = Color.white();

        distanceStack.addSpacer();
        distanceStack.size = new Size(60, 0);

        stationStack.addSpacer(STYLE.stationPadding);

        let nameStack = stationStack.addStack();
        let nameElement = nameStack.addText(decodeText(station.name));
        nameElement.font = globalFont;
        nameElement.textColor = Color.white();
        nameElement.textOpacity = 0.7;
        nameElement.lineLimit = 1;
        nameStack.addSpacer();

        let availableStack = stationStack.addStack();

        let bikeStack = availableStack.addStack();
        bikeStack.size = STYLE.valueStackSize;
        let bikeElement = bikeStack.addText(
            String(station.num_bikes_available)
        );
        bikeElement.textColor = Color.green();
        bikeStack.centerAlignContent();

        let ebikeStack = availableStack.addStack();
        ebikeStack.size = STYLE.valueStackSize;
        let ebikeElement = ebikeStack.addText(
            String(station.num_ebikes_available)
        );
        ebikeElement.textColor = Color.blue();
        ebikeStack.centerAlignContent();

        let portStack = availableStack.addStack();
        portStack.size = STYLE.valueStackSize;
        let portElement = portStack.addText(
            String(station.num_docks_available)
        );
        portElement.textColor = Color.white();
        portStack.centerAlignContent();

        availableStack.layoutHorizontally();
        stationStack.layoutHorizontally();
    }

    widget.addSpacer(STYLE.bodyPadding);

    let footerStack = widget.addStack();

    if (text[language].disclaimer !== null) {
        let disclaimerStack = footerStack.addStack();
        disclaimerStack.centerAlignContent();
        let infoSymbol = SFSymbol.named("info.circle");
        let linkSymbolElement = disclaimerStack.addImage(infoSymbol.image);
        linkSymbolElement.imageSize = new Size(11, 11);
        linkSymbolElement.tintColor = Color.blue();
        disclaimerStack.addSpacer(3);
        let disclaimerElement = disclaimerStack.addText(
            text[language].disclaimer
        );
        disclaimerElement.font = Font.mediumSystemFont(13);
        disclaimerElement.textColor = Color.blue();
    }

    footerStack.addSpacer();
    let timestampStack = footerStack.addStack();
    let timestampElement = timestampStack.addText(
        `${text[language].updatedAt} ${getCurrentTime()}`
    );
    timestampElement.font = Font.mediumSystemFont(13);
    timestampElement.textColor = Color.white();
    timestampElement.textOpacity = 0.7;

    return widget;
}

async function bixiAPI() {
    let stations = await loadStations();

    let location = await getCoordinates();

    if (!location) {
        throw "Could not get coordinates";
    }

    for (let station of stations) {
        // Squared Euclidean Distance
        station.sed =
            Math.pow(station.lon - location.longitude, 2) +
            Math.pow(station.lat - location.latitude, 2);
    }

    let closestStations = stations.slice(0, 3);
    for (let i = 3; i < stations.length; i++) {
        const station = stations[i];
        for (let j = 0; j < closestStations.length; j++) {
            if (station.sed < closestStations[j].sed) {
                closestStations[j] = station;
                break;
            }
        }
    }

    closestStations.sort((a, b) => a.sed - b.sed);

    for (let station of closestStations) {
        let value = roundToHundredth(
            getDistanceFromLatLonInKm(
                station.lat,
                station.lon,
                location.latitude,
                location.longitude
            )
        );

        let unit;
        if (value < 1) {
            value *= 1000;
            unit = "m";
        } else {
            unit = "km";
        }

        station.distance = { value, unit };
    }

    const stationStatuses = await loadStationStatuses();
    for (let station of closestStations) {
        for (let status of stationStatuses) {
            if (station.station_id === status.station_id) {
                station.num_bikes_available = status.num_bikes_available;
                station.num_ebikes_available = status.num_ebikes_available;
                station.num_docks_available = status.num_docks_available;
            }
        }
    }

    // Trim station objects
    closestStations = closestStations.map((station) => {
        return {
            name: station.name,
            num_bikes_available: station.num_bikes_available,
            num_ebikes_available: station.num_ebikes_available,
            num_docks_available: station.num_docks_available,
            distance: station.distance,
        };
    });

    return closestStations;
}

async function loadStations() {
    let url = "https://gbfs.velobixi.com/gbfs/en/station_information.json";
    let req = new Request(url);
    return (await req.loadJSON()).data.stations;
}

async function loadStationStatuses() {
    let url = "https://gbfs.velobixi.com/gbfs/en/station_status.json";
    let req = new Request(url);
    return (await req.loadJSON()).data.stations;
}

async function loadAppIcon() {
    let url =
        "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Bixi_logo.svg/2560px-Bixi_logo.svg.png";
    let req = new Request(url);
    return await req.loadImage();
}

function decodeText(encodedText) {
    return decodeURIComponent(
        encodedText
            .replace(/Ã©/g, "é")
            .replace(/Ã¨/g, "è")
            .replace(/Ã /g, "à")
            .replace(/Ã¹/g, "ù")
            .replace(/Ã´/g, "ô")
            .replace(/Ã®/g, "î")
            .replace(/Ãª/g, "ê")
            .replace(/Ã¢/g, "â")
            .replace(/Ã«/g, "ë")
            .replace(/Ã¯/g, "ï")
            .replace(/Ã¼/g, "ü")
            .replace(/Ãœ/g, "Ü")
            .replace(/Ã¤/g, "ä")
            .replace(/Ã¶/g, "ö")
            .replace(/ÃŸ/g, "ß")
            .replace(/Ã§/g, "ç")
            .replace(/Ã¦/g, "æ")
            .replace(/Ã¦/g, "Æ")
            .replace(/Ãœ/g, "Ü")
            .replace(/Ã¸/g, "ø")
            .replace(/Ã…/g, "å")
            .replace(/Ã‡/g, "Ç")
            .replace(/Â/g, "")
    );
}

function createDistanceString({ value, unit }) {
    let valueString = String(value);

    const int = String(Math.trunc(value));
    if (int.length === 3) {
        valueString = int;
    } else if (int.length > 3) {
        valueString = "999+";
    }
    return `${valueString} ${unit}`;
}

// from https://stackoverflow.com/a/27943
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1); // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) *
            Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function roundToHundredth(num) {
    return Math.round(num * 100) / 100;
}

function getCurrentTime() {
    const now = new Date();

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
}

async function getCoordinates() {
    try {
        const location = await Location.current();
        const coords = {
            latitude: location.latitude,
            longitude: location.longitude,
        };

        saveCoordinates(coords);

        return coords;
    } catch (error) {
        console.log("Error fetching location: " + error);
        text.english.disclaimer = "Could not fetch location";
        text.french.disclaimer = "Échec de localisation";
        return getSavedCoordinates();
    }
}

function saveCoordinates(coords) {
    const fm = FileManager.local();
    const path = fm.joinPath(fm.documentsDirectory(), "lastCoordinates.json");
    fm.writeString(path, JSON.stringify(coords));
}

function getSavedCoordinates() {
    const fm = FileManager.local();
    const path = fm.joinPath(fm.documentsDirectory(), "lastCoordinates.json");

    if (fm.fileExists(path)) {
        const savedCoordsString = fm.readString(path);
        return JSON.parse(savedCoordsString);
    } else {
        return null;
    }
}

function saveStations(stations) {
    const fm = FileManager.local();
    const path = fm.joinPath(fm.documentsDirectory(), "lastStations.json");
    fm.writeString(path, JSON.stringify(stations));
}

function getSavedStations() {
    const fm = FileManager.local();
    const path = fm.joinPath(fm.documentsDirectory(), "lastStations.json");

    if (fm.fileExists(path)) {
        const savedStationsString = fm.readString(path);
        return JSON.parse(savedStationsString);
    } else {
        return null;
    }
}
