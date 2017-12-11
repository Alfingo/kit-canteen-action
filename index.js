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
        'failed': 'Sorry, I couldn\'t get the meals for that day.'
    },
    de: {
        'offers': 'bietet',
        'and': 'und',
        'noday': 'Bitte nenne mir einen Tag.',
        'closed_weekend': 'Die Mensa ist am Wochenende geschlossen.',
        'failed': 'Sorry, ich konnte den Speiseplan nicht abrufen.'
    }
}

app.use(bodyParser.json())

app.post('/', (req, res) => {
    if (DEBUG) console.log(req.body)

    let lang = resolveLanguage(req.body.lang)

    if (!req.body.result.metadata.intentName === 'GetFood_Intent') {
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
            switch (dateParam) {
                case 'tomorrow':
                    return Date.today().addDays(1)
                case 'monday':
                    return Date.today().next().monday()
                case 'tuesday':
                    return Date.today().next().tuesday()
                case 'wednesday':
                    return Date.today().next().wednesday()
                case 'thursday':
                    return Date.today().next().thursday()
                case 'friday':
                    return Date.today().next().friday()
                case 'saturday':
                    return Date.today().next().saturday()
                case 'sunday':
                    return Date.today().next().sunday()
                default:
                    return Date.today()
            }
        case 'de':
            switch (dateParam) {
                case 'morgen':
                    return Date.today().addDays(1)
                case 'montag':
                    return Date.today().next().monday()
                case 'dienstag':
                    return Date.today().next().tuesday()
                case 'mittwoch':
                    return Date.today().next().wednesday()
                case 'donnerstag':
                    return Date.today().next().thursday()
                case 'freitag':
                    return Date.today().next().friday()
                case 'samstag':
                    return Date.today().next().saturday()
                case 'sonntag':
                    return Date.today().next().sunday()
                default:
                    return Date.today()
            }
    }

}

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))