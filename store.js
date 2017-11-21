function DPDStore(storeID, initCallback){
	this.storeID = storeID;
	this.isInitialized = false; //this is true after the store is successfully initialized
	this.items = []; //this will be generated for the store after connecting
	this.initCallback = initCallback; //if set, will be called after the store is initialized
	
	//FIXME: multiple listeners should be possible
	this.newListener;
	this.updateListener;
	this.deleteListener;
}

/*
 * Listener function requires one parameter for the submitted object
 */
DPDStore.prototype.setNewListener = function(listener){
	this.newListener = listener;
}

/*
 * Listener function requires one parameter for the submitted object
 */
DPDStore.prototype.setUpdateListener = function(listener){
	this.updateListener = listener;
}

/*
 * Listener function requires one parameter for the submitted object
 */
DPDStore.prototype.setDeleteListener = function(listener){
	this.deleteListener = listener;
}

DPDStore.prototype.connect = function( params ){
	var self = this;
	dpd[this.storeID].get(params, function(itemList, error) { //Use dpd.js to access the API

		//FIXME: somehow this is triggered twice, second time with itemList = null. This workarround will not work with empty collections
		if (itemList != null) {
			//create lookup index to quickly get objects by id
			for (var i = 0, len = itemList.length; i < len; i++) {
				self.items[itemList[i].id] = itemList[i];			
			}
			
			self.afterInit();
		}
	});
	
};

DPDStore.prototype.getByID = function(id){
	
	if (!this.isInitialized) {
		console.log('Error: DPDStore ' + this.storeID + ' is not initialized yet.');
		return;
	}
	
	if (id in this.items){
		return this.items[id];
	} else {
		return {error : true, message : 'object with id : ' + id + ' not in ' + this.storeID + ' store'};
	}
};

DPDStore.prototype.afterInit = function(){
		var self = this;

	dpd[this.storeID].on('update', function(item) {
		self.items[item.id] = item;
		if (jQuery.isFunction(self.updateListener)){
			self.updateListener(item);
		}	
	});
	
	dpd[this.storeID].on('delete', function(item) {
		delete self.items[item.id];
		if (jQuery.isFunction(self.deleteListener)){
			self.deleteListener(item);
		}
	});
	
	dpd[this.storeID].on('new', function(item) {
		self.items[item.id] = item;
		if (jQuery.isFunction(self.newListener)){
			self.newListener(item);
		}
	});
	
	console.log(this.storeID + ' finished initializing');
	this.isInitialized  = true;
	if (jQuery.isFunction(this.initCallback)){
		this.initCallback();
	}
};

/* 
* this is just exposing the put function of the store (see http://docs.deployd.com/docs/collections/reference/dpd-js.html#s-.post([id], object, fn))
*
*	Please note, that the optional "id" property is not available here
*/
DPDStore.prototype.post = function(data, callback){
	dpd[this.storeID].post(data, callback);
};

/* 
* this is just exposing the put function of the store (see http://docs.deployd.com/docs/collections/reference/dpd-js.html#s-.put([id or query], object, fn))
*
*	Please note, that "id_or_query" can be both the object id or the object query as JS is not type save and does not have overloaded functions
*/
DPDStore.prototype.put = function(id_or_query, data, callback){
	dpd[this.storeID].put(id_or_query, data, callback);
};

/* 
* this is just exposing the delete function of the store (see http://docs.deployd.com/docs/collections/reference/dpd-js.html#s-.del(id or query, fn))
*
*	Please note, that "id_or_query" can be both the object id or the object query as JS is not type save and does not have overloaded functions
*/
DPDStore.prototype.del = function(id_or_query, callback){
	dpd[this.storeID].put(id_or_query, callback);
};
