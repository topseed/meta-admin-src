
declare var Logger: any
//declare var LogzioLogger: any

var token = 'uCWXDUBVYBqZfGBzYBHYoewoUnRQawYI'

Logger = new LogzioLogger(token)
console.log('Logger ready. View logs on logz.io')

Logger.log({
	param1: 'value1',
	param2: 'value2',
	message: 'Oh hi'
})