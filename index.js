const app = require('express')(),
    bodyParser = require('body-parser'),
    cache = require('memory-cache'),
    axios = require('axios'),
    dotenv = require('dotenv').config(),
    datejs = require('datejs') // overrides Date

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000
const DEBUG = process.env.DEBUG === 'true' ? true : false
const DEFAULT_CANTEEN_ID = 31
const OPENMENSA_BASE = 'https://openmensa.org/api/v2/canteens'

const strings = {
    en: {
        'offers': 'offers',
        'and': 'and',
        'noday': 'Sorry, you need to tell me a specific day.',
        'closed_weekend': 'The canteen is closed on weekends.',
        'failed': 'Sorry, I couldn\'t get the meals for that day. May the canteen be closed on that day?'
    },
    de: {
        'offers': 'bietet',
        'and': 'und',
        'noday': 'Bitte nenne mir einen Tag.',
        'closed_weekend': 'Die Mensa ist am Wochenende geschlossen.',
        'failed': 'Sorry, ich konnte den Speiseplan nicht abrufen. Hat die Mensa an diesem Tag vielleicht geschlossen?'
    }
}

app.use(bodyParser.json())

app.post('/', (req, res) => {
    if (DEBUG) console.log(req.body)

    let lang = resolveLanguage(req.body.lang)

    if (!req.body.result.metadata.intentName === 'GetFood_Intent' || !req.body.result.parameters.day) {
        let message = string[lang]['noday']
        return res.send({ speech: message, displayText: message })
    }

    let date = resolveDate(req.body.result.parameters.day, lang)

    if (!date.is().weekday()) {
        let message = strings[lang]['closed_weekend']
        return res.send({ speech: message, displayText: message })
    }

    getOrFetchMeals(DEFAULT_CANTEEN_ID, date)
        .then(result => {
            let message = buildMealSummary(result, lang)
            return res.send({ speech: message, displayText: message })
        })
        .catch(() => {
            let message = strings[lang]['failed']
            return res.send({ speech: message, displayText: message })
        })
})

function resolveLanguage(locale) {
    if (/de/gi.test(locale)) return 'de'
    else return 'en'
}

function getOrFetchMeals(canteenId, date) {
    let cachedData = cache.get(`${canteenId}-${date.toString()}`)
    if (cachedData) return Promise.resolve(cachedData)

    let url = `${OPENMENSA_BASE}/${canteenId}/days/${date.toString('yyyy-MM-dd')}/meals`
    if (DEBUG) console.log(`Requesting ${url}`)
    return axios.get(url)
        .then(res => {
            cache.put(`${canteenId}-${date.toString()}`, res.data, 1000 * 60 * 60 * 24)
            return res.data
        })
}

function buildMealSummary(mealData, lang) {
    let lines = {}
    let summary = ''

    mealData.forEach(entry => {
        if (!/Linie|L6/gi.test(entry.category)) return
        if (!lines.hasOwnProperty(entry.category)) lines[entry.category] = []
        if (entry.name.split(' ').length > 2 && startsWithCapitalLetter(entry.name)) {
            let splitIdx = entry.name.indexOf('[') > 0 ? entry.name.indexOf('[') : entry.name.length
            lines[entry.category].push(entry.name.substring(0, splitIdx))
        }
    })

    Object.keys(lines).forEach(line => {
        let meals = lines[line]
        for (let i = 0; i < meals.length; i++) {
            if (i == 0) summary += `${line} ${strings[lang]['offers']} `
            else summary += ` ${strings[lang]['and']} `
            summary += meals[i]
        }
        summary += '. '
    })

    return summary
}

function startsWithCapitalLetter(word) {
    return word.charCodeAt(0) >= 65 && word.charCodeAt(0) < 97;
}

function resolveDate(dateParam, lang) {
    switch (lang) {
        case 'en':
            switch (dateParam.toLowerCase()) {
                case 'tomorrow':
                    return new Date().addDays(1)
                case 'monday':
                    return new Date().next().monday()
                case 'tuesday':
                    return new Date().next().tuesday()
                case 'wednesday':
                    return new Date().next().wednesday()
                case 'thursday':
                    return new Date().next().thursday()
                case 'friday':
                    return new Date().next().friday()
                case 'saturday':
                    return new Date().next().saturday()
                case 'sunday':
                    return new Date().next().sunday()
                default:
                    return new Date()
            }
        case 'de':
            switch (dateParam.toLowerCase()) {
                case 'morgen':
                    return new Date().addDays(1)
                case 'montag':
                    return new Date().next().monday()
                case 'dienstag':
                    return new Date().next().tuesday()
                case 'mittwoch':
                    return new Date().next().wednesday()
                case 'donnerstag':
                    return new Date().next().thursday()
                case 'freitag':
                    return new Date().next().friday()
                case 'samstag':
                    return new Date().next().saturday()
                case 'sonntag':
                    return new Date().next().sunday()
                default:
                    return new Date()
            }
    }

}

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))