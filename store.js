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
		//FIXME: this is very resource hungry, since our arrays indexes are not in sequential order it has to do for now
		self.items.splice($.inArray(item, self.items),1);
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
