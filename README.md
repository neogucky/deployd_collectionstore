# deployd_collectionstore
Simple collection store to handle updated / added or deleted items 

This is building on the easy to use API-Framework deployd. See: http://deployd.com

It requires the following events setup in all collections meant to be used: 

	post event:
	emit('COLLECTIONNAME:new', this);

	put event:
	emit('COLLECTIONNAME:update', this);

	delete event:
	emit('COLLECTIONNAME:delete', this);

Where COLLECTIONNAME is obviously the name of your collection. (i.e. the put-event for my collection "apples" would be emit('apples:new', this);)

The store can then be used like this. It requires the collection name as an argument, optionaly you can also add a method that will be called after the asynchronous request finished.

	appleStore = new DPDStore('apples', function() { renderApples(); });
	appleStore.connect();

This will load the apples collection, store it in our appleStore and then call your local renderApples() function.

Remember, renderApples is a local method created by you. You don't have to add any callBack function to the store but than you should make sure: appleStore.isInitialized == true, since the connect-request is asynchronous. The renderApples() function might look like this. 

	function renderApples() {
				
		$('#apples').empty(); //Empty the list
		appleStore.items.forEach(function(item) {
			$('<tr id="' + item.id + '">')
				.append('<td>' + item.name + '</td>')
				.append('<td>' + item.color + '</td>')
				.appendTo('#apples');
		});	
	});
	
You also can add some listeners, to update your apple-table according to changes:

	//only delete the deleted apple 
	appleStore.setDeleteListener( function(item) {
		$('#' + item.id).remove();
	});

	//render all apples new when there are new or changed apples
	appleStore.setUpdateListener(renderApples);
	appleStore.setNewListener(renderApples);
	
Keep in mind, that the store updates itself with every change, even if you don't have any listeners on it. This can create a massive network overhead, so you should think if this store fits your needs before using it.

It is possible to add specific parameters to the queries. This is relevant to prevent bottlenecks (i.e. always loading everything). A full lsit of all parameters can be found here: http://docs.deployd.com/docs/collections/reference/querying-collections.html

	//load only the 10 newest apples
	appleStore = new DPDStore('apples', function() { renderApples(); });
	appleStore.connect(
		{   $sort: {dateTime: -1}, /* sort descending to not getting the 10 oldest */
    		    $limit: 10 }
	);
	
Take note, the results will be sorted descending as well, so you probably need to sort them again.
	
To add, update or delete items you can use the functions provided by dpd (see post, put and del:  http://docs.deployd.com/docs/collections/reference/dpd-js.html ) You don't have to remember the collection name to call 
	
	appleStore.put({...}, callback) //puts (creates) data in {...} object to the api-database
	appleStore.del("91c621a3026ca8ef", callback) //deletes the object with the id 91c621a3026ca8ef (you can also use querys, see documentation)
	appleStore.post("91c621a3026ca8ef", {...}, callback) /post data in {...} object to the object with the ID 91c621a3026ca8ef
	
This is not meant to be super inventive but to streamline your code, allowing to only work with the store object instead of mixing it with dpd calls.

Best practise is to never change the content of store.items but to add / edit elements with the put / del / post functions. All changes will be mirrored back to your stores and you can react to them in your listeners.
