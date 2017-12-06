var meldungen = ['OrtsNetzstation Dankwartsgrube überschreitet maximale Kapazität.', 'OrtsNetzstation Dankwartsgrube arbeitet wieder in den vorgegebenen Parametern. (Entwarnung)', 'Ortsnetzstation Universität sendet keine Daten mehr.', 'Ortsnetzstation Universität sendet wieder Daten (Entwarnung).', 'Blockheizkraftwerk Universität produziert unerwartet hohe Stromkapazitäten.', 'Ortsnetzstation Universität hat einen negativen Verbrauch.', 'Ortsnetzstation Universität kann überproduktion nicht mehr an das Mittelspannungsnetz leiten.',  'Blockheizkraftwerk Universität meldet bevorstehende Kernschmelze.' ];

$(document).ready(function() {

	//generator options
	//FIXME: load these from json for different szenarios etc.
	//FIXME: variable for sunnynes, variable for windynes, weekend / weekday?
	var options = {
		
		timeSequence : { /* in hours */
			0 : 2, /* night */
			8 : 1, /* day */
			18 : 3, /* evening */
			22 : 2, /* night */
			32 : 1, /* day */
			42 : 4, /* evening_wm */
			47 : 2, /* night */
		},
		millisecondsPerMinute: 50, /* how many millisends a simulated minute takes (10 minutes per second) */
		refreshRate: 2000, /* how often the values will be refreshed in milliseconds */
		connectionGraceTime: 5000, /* How many milliseconds after the last succesfull call until another simulator can "steal" the connection */
		states : {
			1 : { /* the typical day 0.3 to 0.7 capacity but industry at 0.4 to 0.8*/
			  name : 'day',
			  values : {
				default : {
					variation : 0.2,
					median : 0.5
					},
				industry : {
					variation : 0.2,
					median : 0.6
					},
				powerWind : {
					variation : 0.5,
					median : 0.5
					},
				powerSun : {
					variation : 0.4,
					median : 0.6
					},
				powerConventional : {
					variation : 0.2,
					median : 0.8
					}						
				}
			},
			2 : { /* the typical night 0.3 to 0.5 capacity */
			 name : 'night',
			 values : {
				default : {
					variation : 0.1,
					median : 0.4
					},
				industry : {
					variation : 0.1,
					median : 0.2
					},
				powerWind : {
					variation : 0.5,
					median : 0.5
					},
				powerSun : {
					variation : 0.05,
					median : 0.05
					},
				powerConventional : {
					variation : 0.2,
					median : 0.8
					}						
				}
			},
			3 : {/* the typical evening 0.6 to 1.0 capacity */
			  name : 'evening',
			  values : {
				default : {
					variation : 0.2,
					median : 0.8
					},
				industry : {
					variation : 0.15,
					median : 0.3
					},
				powerWind : {
					variation : 0.5,
					median : 0.5
					},
				powerSun : {
					variation : 0.05,
					median : 0.05
					},
				powerConventional : {
					variation : 0.2,
					median : 0.8
					}						
				}
			},
			4 : { /* evening germany vs. italy in the world finals 0.75 to 1.05 capacity */
			  name : 'evening_wm',
			  values : {
				default : {
					variation : 0.15,
					median : 0.9
					},
				industry : {
					variation : 0.05,
					median : 0.1
					},
				powerWind : {
					variation : 0.5,
					median : 0.5
					},
				powerSun : {
					variation : 0.05,
					median : 0.05
					},
				powerConventional : {
					variation : 0.2,
					median : 0.8
					}						
				}
			}
		}		
	};
	
	var time = 1; //milliseconds since 00:00 on the first day
	var isRunning = false;
	var self = this;
	var change = [];
	
	var isConnected = false;
	var loggedinUser;
	
	var stores = [];
	//initialize stores (dirty sequential chaining)
	stores['transformerstation'] = new DPDStore('transformerstation', function() { stores['substation'].connect(); });
	stores['substation'] = new DPDStore('substation', function() { stores['powerstation'].connect(); });
	stores['powerstation'] = new DPDStore('powerstation', function() { stores['area'].connect(); });
	stores['area'] = new DPDStore('area',  function() { stores['alarm'].connect(); });
	stores['alarm'] = new DPDStore('alarm', function() { $('#alarms').text('alarms: ' +  Object.keys(stores['alarm'].items).length); stores['connection'].connect(); });
	stores['connection'] = new DPDStore('connection', function() { stores['simulator'].connect(); });
	stores['simulator'] = new DPDStore('simulator', dpdStoreReady);
	
	
	//start the chain
	stores['transformerstation'].connect();
	$('#status').css('color', 'orange');
	$('#status').text('Connecting...');
	

	stores['alarm'].setNewListener(function(alarm) {
		//refresh alarm count
		$('#alarms').text('alarms: ' +  Object.keys( stores['alarm'].items ).length);
	});
	stores['alarm'].setDeleteListener(function(alarm) {
		//refresh alarm count
		console.log(stores['alarm'].items);
		$('#alarms').text('alarms: ' +  Object.keys( stores['alarm'].items ).length);
	});

	function dpdStoreReady() {
		
		$('#status').text('Connected - waiting for login');
		$('#status').css('color', '#925e00');
		isConnected = true;
		
		self.session = new DPDSession(stores['simulator']);
		
		//TODO: Add list view of current system status (stations, connections, active states, throughput, status)
	}

	function startLoop(){
		
		if (isConnected) {
			//reserve token
			
			console.log(self.session);
			
			self.session.getSession(
				function(){
					//success
					self.isRunning = true;
					simulationLoop();
				},
				function(error){
					//error
					self.isRunning = false;
					$('#status').css('color', 'red');
					$('#status').text(error);
				}
			);			
		} else {
			$('#status').css('color', 'orange');
			$('#status').text('Connecting... ( If this takes an unusual amount of time reload the page. )');
		}
	}
	
	
	/*
	*	Some energy grid theory:
	* 	Every transformer station should be connected to exactly one sub station. It is possible to be connected to two substations but this should be avoided. 
	* 	Transformer stations can produce more energy (through connected EEG sources) than the grid needs, in this case the sub stations have to shift the energy upstream.
	*	The sub station maximum throughput is affected by changes in the high-voltage grid. It is possible, that there is no room to shift enery upstream
	*/
	function  simulationLoop() {
		
		$('#status').text('Connected- Simulation is running');
		$('#status').css('color', 'green');

		//let the session know we still need it		
		self.session.extendSession();
		console.log(self.session.getSessionLifetime); //FIXME: show this in LOGIN Box
		
		if (!self.isRunning) {
			$('#status').text('Connected - Simulation is paused');
			$('#status').css('color', 'green');
			return; //if not running cancel loop
		}
		
		var t = new Date( time );
		$('#currentDateTime').text(t);
				
		var currentState = getCurrentState();
		$('#currentState').text(currentState.name);
		
		createEnergyPathes();
		updateTransformerStations(currentState);
		updatePowerStations(currentState);
		updateSubStations(currentState);
		updateConnections();
		
		time +=  options.refreshRate / options.millisecondsPerMinute * 60000;
		
		setTimeout(simulationLoop, options.refreshRate );
	}
	
	
	//FIXME: We need a way to calculate stations with power-shortages. Maybe saving power demand in the generator and firing alarm messages when the demand is higher than the actual delivery.
	function updateTransformerStations(currentState){
		//change the values 
		for (key in stores['transformerstation'].items) {
			var transformerStation = stores['transformerstation'].items[key];
			var station = Station.fromTransformerStation(transformerStation);
			
			var calculatedStationConsumption = calculateUpdatedConsumption(station, currentState.values.default);
			
			if (transformerStation.pathToSubstation.length == 0){
				//if no substation is connected the transformerstation will have no energy
				calculatedStationConsumption = 0;
				generateAlarm(6 /*medium important*/, objectType.transformerstation, alarmType.powerFailure, "Transformer station " + transformerStation.name + " is currently not connected to the energy grid causing blackouts.", transformerStation);
			} else {
				//update all connections to nearest substation
				for (key in transformerStation.pathToSubstation) {
					transformerStation.pathToSubstation[key].capacityKWh = transformerStation.pathToSubstation[key].capacityKWh + calculatedStationConsumption;
				}
			}
						
			updateTransformerStationCapacity(station, calculatedStationConsumption);
		}
	}
	
	function updatePowerStations(currentState){
		//change the values 
		for (key in stores['powerstation'].items) {
			var powerStation = stores['powerstation'].items[key];
			var station = Station.fromPowerStation(powerStation);
			
			var capacityCap = 1;
			var calculatedPowerConsumption = 0;
			
			//modify capacityCap according to weather and powerStation type:
			switch (powerStation.powerType){
				case 1 /* wind */:
					calculatedPowerConsumption = -calculateUpdatedConsumption(station, currentState.values.powerWind);
					break;
				case 2 /* solar */:
					calculatedPowerConsumption = -calculateUpdatedConsumption(station, currentState.values.powerSun);
					break;
				default:
					calculatedPowerConsumption =  -calculateUpdatedConsumption(station, currentState.values.powerConventional);
			}			
			
			console.log(calculatedPowerConsumption);
			
			if (powerStation.pathToSubstation.length == 0){
				//if no substation is connected the powerStation will have no energy
				//FIXME: does this even make sense?
				calculatedPowerConsumption = 0;
				generateAlarm(9 /*important*/, objectType.powerstation, alarmType.powerFailure, "Power station " + powerStation.name + " is currently not connected to the energy grid causing frequency loss", powerStation);
			} else {
				//update all connections to nearest substation
				for (key in powerStation.pathToSubstation) {
					powerStation.pathToSubstation[key].capacityKWh = powerStation.pathToSubstation[key].capacityKWh + calculatedPowerConsumption;
				}
			}
			
			updatePowerStationCapacity(station, calculatedPowerConsumption);
		}
	}
	
	function updateSubStations(currentState){
		//change the values 

		for (key in stores['substation'].items) {
			var subStation = stores['substation'].items[key];
			var connections = getConnections(subStation);
			var totalCapacity = 0;
			console.log(connections);

			for (innerkey in connections){
				totalCapacity += connections[innerkey].capacityKWh;
			}
			
			console.log(totalCapacity);
			
			updateSubStationCapacity(subStation, totalCapacity);
		}
	}
	
	function updateConnections(){
		for (key in stores['connection'].items) {
			var connection = stores['connection'].items[key];
			if (connection.capacityKWh > connection.maxCapacityKWh * 1.1){ /* exceeds 10% overload margin */
				generateAlarm(5 /*low importance*/, objectType.connection, alarmType.powerFailure, "The connection: " + connection.name + "'s  load is currently exceeding suggested values and safety margins.", connection);
			} else if (connection.capacityKWh > connection.maxCapacityKWh){ /* exceeds overload */
				generateAlarm(3 /*low importance*/, objectType.connection, alarmType.powerFailure, "The connection: " + connection.name + "'s  load is currently exceeding suggested values.", connection);
			} else if (connection.capacityKWh > connection.maxCapacityKWh * 0.9){  /* might exceed soon */
				generateAlarm(1 /*low importance*/, objectType.connection, alarmType.powerFailure, "The connection: " + connection.name + "'s  load is nearly exceeding suggested values.", connection);
			}
			
			updateConnectionCapacity(connection);
		}
	}
	
	/*
	*	This is rather complicated, since one substation should generate as much energy as the grid needs at any given time. 
	*	Questions for the simulation are:
	*	   - TODO: should this adapt instantly?
	*      - TODO: what happens when there is just not enough energy?
	*      - TODO: what happens when two sub stations are connected?
	*/
	function calculateChildConsumption(station, _visitedStations){
						
		var connectedStations = getAllConnectedStations(station);
		var totalConsumption = 0;
		
		for (key in connectedStations){
			totalConsumption += connectedStations[key].consumptionInKWh;
		}
		
		return totalConsumption;
	}
	
	/*
	* Returns a map between stations and their connections to the nearest substation 
	*/
	function createEnergyPathes(){
				
		for (key in stores['connection'].items) {
			stores['connection'].items[key].capacityKWh = 0;
		}
		
		for (key in stores['substation'].items) {
			stores['substation'].items[key].pathToSubstation = [];
		}
		
		for (key in stores['transformerstation'].items) {
			stores['transformerstation'].items[key].pathToSubstation = [];
		}
		
		for (key in stores['powerstation'].items) {
			stores['powerstation'].items[key].pathToSubstation = [];
		}
				
		//O( k )
		for (key in stores['substation'].items) {
			
			var substation = stores['substation'].items[key];

			//O( n )
			var connections = getConnections(substation);

			//O( k * n * k ) = O ( n )
			for (innerkey in connections){
				console.log('calculatePathToSubstation');
				
				calculatePathToSubstation( substation, connections[innerkey] );
			}
		}		
	}
	
	/*
	 *	Recursively propergates through all connected stations and adds the shortest way to a substation to each visited station
	 *
	 * 	O( n² ) including all recursions (Average should be ( n * log n ))
	 */
	function calculatePathToSubstation(sourceStation, connection){
		
		if (connection.disrupted){
			return;
		}
				
		//get connected transformerStation
		var connectedStation;
		// O( n )
		for (key in stores['transformerstation'].items){
			if (stores['transformerstation'].items[key].id != sourceStation.id && jQuery.inArray(connection.id, stores['transformerstation'].items[key].connectionIDs) !== -1){
				connectedStation = stores['transformerstation'].items[key];
			}
		}
		for (key in stores['powerstation'].items){
			if (stores['powerstation'].items[key].id != sourceStation.id && jQuery.inArray(connection.id, stores['powerstation'].items[key].connectionIDs) !== -1){
				connectedStation = stores['powerstation'].items[key];
			}
		}
		
		if (connectedStation == undefined){
			//either no connection or connection to other substation
			return;
		}
				
		if (connectedStation.pathToSubstation == undefined){
			console.log('pathToSubstation undefined exit jump');
			//connection might have been altered while this loop was going on 
			//FIXME: Make this save by duplicating the connection or something) 
			return;
		}
		
		
		//if there is already a shorter connection, quit (prevents endless loops)
		if (connectedStation.pathToSubstation.length > 0 && connectedStation.pathToSubstation.length <= sourceStation.pathToSubstation.length +1){
			return;
		}
		
		if (sourceStation.pathToSubstation == undefined){
			connectedStation.pathToSubstation = [connection];
		} else {
			connectedStation.pathToSubstation = [connection].concat(sourceStation.pathToSubstation);
		}
				
		// O( n )
		var connections = getConnections(connectedStation);
		console.log(connections);
		// O( k )
		for (key in connections){			
			calculatePathToSubstation( connectedStation, connections[key] );
		}
				
		return;
	}
	
	function getAllConnectedStations(station, _visitedStations){
		//visit all connected stations once
		var visitedStations = [];
		if (_visitedStations !== undefined){
			visitedStations = _visitedStations;
		}

		var connectedStations = getConnectedStations(station);
		
		var unvisitedConnectedStations = [];
		// O( n )
		for (key in connectedStations){
			if (jQuery.inArray(connectedStations[key], visitedStations) === -1){
				visitedStations.push(connectedStations[key]);
				unvisitedConnectedStations.push(connectedStations[key]);
				unvisitedConnectedStations = unvisitedConnectedStations.concat(getAllConnectedStations(connectedStations[key], visitedStations));
			} 
		}
		
		return uniqueArray(unvisitedConnectedStations);
	}
	
	function getConnectedStations(station){
		
		var connections = getConnections(station);
		var connectedStations = [];
				
		//all connections to transformerStations
		for (key in stores['transformerstation'].items){
			for (innerKey in connections){
				if (jQuery.inArray(connections[innerKey].id, stores['transformerstation'].items[key].connectionIDs) !== -1 && !connections[innerKey].disrupted){
					connectedStations.push(stores['transformerstation'].items[key])
				}
			}
		}
		
		//all connections to powerStations
		for (key in stores['powerstation'].items){
			for (innerKey in connections){
				if (jQuery.inArray(connections[innerKey].id, stores['powerstation'].items[key].connectionIDs) !== -1 && !connections[innerKey].disrupted){
					connectedStations.push(stores['powerstation'].items[key])
				}
			}
		}
		
		//uniqueSorts 
		return uniqueArray(connectedStations);
	}
	
	
	function getConnections(station){
				
		var connections = [];

		for (key in station.connectionIDs){
			connections.push(stores['connection'].getByID(station.connectionIDs[key]));
		}

		//uniqueSorts 
		return connections;
	}
	
	
	/*
	*	station : the abstract station 
	*	state : the current grid state (day, night etc.)
	*	capacityCap (optional) : a percentual capacity cap (for example at claudy days for solar generators)
	*/
	function calculateUpdatedConsumption(station, state) {
		
		if (change[station.id] === undefined){
			change[station.id] = 0;
		}
		
		//FIXME: Hardcoded value '30' to smoothen variations per Tick
		var changeOfChange = getRandomPosNeg(station.maxCapacity * state.variation / 30);

		//I like natural numbers
		changeOfChange = Math.floor(changeOfChange);
		
		change[station.id] =  Math.min(change[station.id] + changeOfChange, (station.maxCapacity * state.variation) / 10);
		
		if (station.capacity <  (station.maxCapacity * (state.median - state.variation))){
			//only allow rising changes
			change[station.id] = Math.abs(change[station.id]);
			return station.capacity + change[station.id];
		} else if (station.capacity > (station.maxCapacity * (state.median + state.variation))){
			//only allow falling changes
			change[station.id] = -Math.abs(change[station.id]);
			return station.capacity + change[station.id];
		} else {
			//allow either
			return station.capacity + change[station.id];
		}
	}
	
	
	/*
	*	Returns a number between -border and border
	*/
	function getRandomPosNeg(border){
		return getRandom(-border, border);
	}
	
	function getRandom(min, max) {
		return Math.random() * (max - min) + min;
	}
	
	function getCurrentSequence(hour, sequence){
		lastID = sequence[0];
		for (key in sequence){
			if (key > hour ){
				return lastID;
			}
			lastID = sequence[key];
		}
		
		return lastID;
	}
	
	function getCurrentState(){
		//FIXME: hardcoding!!!
		var currentHour = Math.floor(time / (1000 * 60 * 60)) % 48; //0 - 47 = 2 day loop
		
		var currentTimeSequence = getCurrentSequence(currentHour, options.timeSequence);
		
		return options.states[currentTimeSequence];
	}

	function stopGenerator() {
		
		$('#status').text('Connected - Simulation is paused');
		$('#status').css('color', 'green');
		
		self.isRunning = false;
	}

	function getArea(areaID){
		var areaObject = stores['area'].getByID(areaID);
		if (areaObject.error){
			return areaObject.message;
		} else {
			return areaObject.name;
		}
	}
	
	function getTrigger(triggerTypeID, triggerID){

		if (stores[triggerTypeID] === undefined){
			return 'No store for ' + triggerTypeID + ' available';
		}
				
		var triggerObject = stores[triggerTypeID].getByID(triggerID);
		if (triggerObject.error){
			return triggerObject.message;
		} else {
			return triggerObject.name;
		}
	}
	
	function generateAlarm(importance, type, alarm, errorMessage, alarmSource){
		dpd.alarm.post({
				dateTime: new Date().getTime(), 
				importance: importance,
				triggerTypeID: type,
				triggerID: alarmSource.id,
				alarmType: alarm,
				message: errorMessage,
				areaID: alarmSource.areaID,
				needsAck: importance > 7,
				isAck: false
		}, function(comment, error) {
		});
	}

	function acknowledgeAlarm(event) {
		dpd.alarm.put(event.data.id, {isAck : event.data.isAck} ,function(result, error) {
		  // Do something
		});
	}
	
	function updateTransformerStationCapacity(station, capacity) {
		
		dpd.transformerstation.put(station.id, {consumptionInKWh : capacity} ,function(result, error) {
		  // Do something
		});
	}
	
	function updatePowerStationCapacity(station, capacity){
		
		dpd.powerstation.put(station.id, {consumptionInKWh : capacity} ,function(result, error) {
		  // Do something
		});
	}
	
	function updateSubStationCapacity(station, capacity) {
		
		dpd.substation.put(station.id, {highVolatageIntakeInKWh : capacity} ,function(result, error) {
		  // Do something
		});
	}
	
	function updateConnectionCapacity(connection) {
		dpd.connection.put(connection.id, {capacityKWh : connection.capacityKWh} ,function(result, error) {
		  // Do something
		});
	}
	
	function deleteAlarm (event){
		dpd.alarm.del(event.data.id, function(result, error) {
		  // Do something
		});
	}
	
	function uniqueArray(array) {
		return $.grep(array, function(el, index) {
			return index == $.inArray(el, array);
		});
	}
	
	/*
	*	The following functions will hurt any reasonable programmers soul
	*/

	var deleteAlarmPointer;
	
	function deleteSomeAlarms(event){
		var alarms = stores['alarm'].items;
		
		deleteAlarmPointer =  Math.min(Object.keys(alarms).length -1, event.data.amount); //delete only some alarms, except there are fewer than specified
		console.log('Delete ' + deleteAlarmPointer + ' alarm messages');
				
		deleteSomeAlarmsRecursively();

	}
	
	function deleteSomeAlarmsRecursively(){
		console.log('try to delete: ' + Object.keys(stores['alarm'].items)[deleteAlarmPointer]);
		
		dpd.alarm.del( Object.keys(stores['alarm'].items)[deleteAlarmPointer], function(){
			if (error == undefined){
				console.log('successfully deleted alarm ' + Object.keys(stores['alarm'].items)[deleteAlarmPointer] );
			} else {
				console.log(error);
			}
			
			if (deleteAlarmPointer-- > 0 && Object.keys( stores['alarm'].items).length > 0){
				 deleteSomeAlarmsRecursively(); 
			}
		});
	}
	
	function deleteAllAlarms(){
		var alarms = stores['alarm'].items;
		console.log('Delete ' + Object.keys(alarms).length + ' alarm messages');
		
		deleteAlarmPointer =  Object.keys(alarms).length -1;
		
		deleteAlarmsRecursively();
		//for (key in alarms) {
		//	dpd.alarm.del( alarms[key].id,function(){
		//		console.log('successfully deleted alarm ' + key );
		//	});
		//};
	}
	
	/* 
	*	Deletes only one alarm at a time
	*/
	function deleteAlarmsRecursively() {
		
		var key = Object.keys(stores['alarm'].items)[deleteAlarmPointer];
		
		dpd.alarm.del( key, function(result, error){
			if (error == undefined){
				console.log('successfully deleted alarm ' + key );
			} else {
				console.log(error);
			}
			
			if (deleteAlarmPointer-- > 0 && Object.keys( stores['alarm'].items).length > 0){
				 deleteAlarmsRecursively(); 
			} else {
				console.log('Finished deleting alarms');
			}
		});
	}
	
	function deleteAllSessions(){
		var sessions = stores['simulator'].items;
		
		console.log('Delete ' + Object.keys(sessions).length + ' alarm messages');
		deleteSessionPointer =  Object.keys(sessions).length -1;
		
		deleteSessionsRecursively();
	}

	function deleteSessionsRecursively() {
		
		var key = Object.keys(stores['simulator'].items)[deleteSessionPointer];
		
		dpd.simulator.del( key, function(result, error){
			if (error == undefined){
				console.log('successfully deleted session ' + key );
			} else {
				console.log(error);
			}
			
			if (deleteSessionPointer-- > 0 && Object.keys( stores['simulator'].items).length > 0){
				 deleteSessionsRecursively(); 
			} else {
				console.log('Finished deleting sessions');
			}
		});
	}
	
	
	/*
	*	Login functions
	*/
	
	$('<a id="logout" class="button">')
	.text('logout')
	.click(logout)
	.appendTo('#loginBox');
		
	$('<a id="login" class="button">')
	.text('login')
	.click(showLogin)
	.appendTo('#loginBox');
	
	$('<a class="button">')
	.text('reset session')
	.click(disconnectGenerator)
	.appendTo('#loginBox');

	function showLogin(){
		$('div#loginWrapper').show();
		$('div#loginPopup').show();
	}
	
	$('input#loginButton').click(function() {
		dpd.users.login({
		  username: $('input#username').val(),
		  password: $('input#password').val()
		}, function(result, error) {
			if (error != undefined){
				$('p#loginError').text('Login failed: ' + error.message);
				$('p#loginError').show();
			} else {
				$('div#loginPopup').hide();	
				$('div#loginWrapper').hide();
				$('p#loginError').hide();
				$('span#loginText').text('Logged in as: ' +  $('input#username').val());
				$('span#loginText').css('color', 'green');
				$('a#login').text('change user');
				$("a").show();
				stopGenerator();
				loggedinUser = $('input#username').val();
				$('input#password').val('')
			}
			
		});
	});
	
	function logout(){ 
		dpd.users.logout(function(result, error) {
			$('span#loginText').text('Not logged in');
			$('span#loginText').css('color', 'brown');
			$('a#login').text('login');
			$("a").hide();
			$("a#login").show();
			$('#status').text('Connected - waiting for login');
			$('#status').css('color', '#925e00');
		});
	}
	
	function disconnectGenerator(){
		
		stopGenerator();
		
		for (key in stores['simulator'].items){
			if (loggedinUser == stores['simulator'].items[key].user){
				dpd.simulator.del( stores['simulator'].items[key].id, function(){
				});
			}
		}
		
		$('#status').text('Connected - start generator for session');
		$('#status').css('color', 'orange');
		
	}
	
	$('input#cancelButton').click(function() {
		$('div#loginPopup').hide();	
		$('div#loginWrapper').hide();
		$('p#loginError').hide();
	});
		
	$('div#loginPopup').hide();	
	$('div#loginWrapper').hide();
				
	$('<a class="button">')
		.text('start generator')
		.click(startLoop)
		.appendTo('#statusBox');
			
	$('<a class="button">')
		.text('stop generator')
		.click(stopGenerator)
		.appendTo('#statusBox');
		
	/*
	$('<a class="button">')
		.text('reset sessions')
		.click(deleteAllSessions)
		.appendTo('#statusBox');	
	*/
	
	$('<a class="button">')
		.text('delete all alarms')
		.click(deleteAllAlarms)
		.appendTo('#alarmBox');
						
	 $("a").hide();
	 $("a#login").show();
	
});