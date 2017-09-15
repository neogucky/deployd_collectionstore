function Store(storeID, initCallback){
	this.storeID = storeID;
	this.isInitialized = false; //this is true after the store is successfully initialized
	this.items = []; //this will be generated for the store after connecting
	this.initCallback = initCallback; //if set, will be called after the store is initialized
	
	this.newItemListener;
	this.updatedItemListener;
	this.deletedItemListener;
}

/*
 * Listener function requires one parameter for the submitted object
 */
Store.prototype.setNewListener = function(listener){
	this.newItemListener = listener;
}

Store.prototype.setUpdatedListener = function(listener){
	this.updatedItemListener = listener;
}

Store.prototype.setDeletedListener = function(listener){
	this.deletedItemListener = listener;
}

Store.prototype.connect = function(){
	var self = this;
	dpd[this.storeID].get(function(itemList, error) { //Use dpd.js to access the API

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

Store.prototype.getByID = function(id){
	
	if (!this.isInitialized) {
		console.log('Error: Store ' + this.storeID + ' is not initialized yet.');
		return;
	}
	
	if (id in this.items){
		return this.items[id];
	} else {
		return {error : true, message : 'object with id : ' + id + ' not in ' + this.storeID + ' store'};
	}
};

Store.prototype.afterInit = function(){
		var self = this;

	dpd[this.storeID].on('update', function(item) {
		console.log('update: ' + this.storeID + ' ID: ' + item.id);
		this.items[item.id] = item;
		
		if (jQuery.isFunction(self.updatedItemListener)){
			self.updatedItemListener(item);
		}
		
	});
	
	dpd[this.storeID].on('delete', function(item) {
		console.log('delete: ' + this.storeID + ' ID: ' + item.id);
		//FIXME: this is very resource hungry, since our arrays indexes are not in sequential order it has to do for now
		arr.splice($.inArray(item, arr),1);
		
		if (jQuery.isFunction(self.deletedItemListener)){
			self.deletedItemListener(item);
		}
		
	});
	
	dpd[this.storeID].on('new', function(item) {
		console.log('new: ' + this.storeID + ' ID: ' + item.id);
		this.items[item.id] = item;
		
		if (jQuery.isFunction(self.newItemListener)){
			self.newItemListener(item);
		}
		
	});
	
	console.log(this.storeID + ' finished initializing');
	this.isInitialized  = true;
	if (jQuery.isFunction(this.initCallback)){
		this.initCallback();
	}
};