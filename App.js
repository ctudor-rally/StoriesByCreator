Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [
        {
            xtype:'container',
            itemId:'header',
            cls:'header'
        },
        {
            itemId: 'releaseFilter'
        },
        {
            xtype: 'container',
            itemId: 'grid'
        }
    ],

    launch: function() {
    	
        this.down('#releaseFilter').add({
            xtype: 'rallyreleasecombobox',
            itemId: 'releaseComboBox',
            fieldLabel: 'Select a Release',
            width: 275,
            storeConfig: {
                listeners: {
                    load: this._onLoad,
                    scope: this
                }
            },
            listeners: {
                select: this._onSelect,
                scope: this
            }
        });
    },
    
    _onLoad: function(comboBox) {

        this._drawHeader();
        
        var userStoryFilterConfig = {
            property:'Release',
            operator: '=',
//            value: this.down('#releaseComboBox').getValue()
            value: "/release/5800952120"
        };
        
        this.userStoryStore = Ext.create('Rally.data.WsapiDataStore', {
            model: 'HierarchicalRequirement',
            autoLoad: true,
            fetch : "FormattedID,Name,Owner,DisplayName,RevisionHistory,Revisions,RevisionNumber,Project,ScheduleState",
            filters: userStoryFilterConfig,
            context: {
            	projectScopeUp: false,
            	projectScopeDown: true
            },
            listeners: {
                load: this._onUserStoryStoreDataLoaded,
                scope: this
            }
        });
    },

    _onUserStoryStoreDataLoaded: function(store, data) {

        var records = [];
        var scope = this;
        Ext.Array.each(data, function(record) {
            records.push({
            	FormattedID: record.get('FormattedID'),
            	Name: record.get('Name'),
                ScheduleState: record.get('ScheduleState'),
                CreationDate: this._calculateCreationDate(record),
                Owner: this._calculateOwner(record.get('Owner')),
                CreatedBy: this._calculateCreatedBy(record),
                AcceptedBy: this._calculateAcceptedBy(record)
            });
        }, this);

        if (this.grid) {
        	
        	var newStore = Ext.create('Rally.data.custom.Store', {
	                data: records,
	                pageSize: 3
            });
        	this.grid.getView().bindStore(newStore);
        	
        	this.grid.setLoading(false);
        	
        } else {

	 	    this.grid = this.add({
	            xtype: 'rallygrid',
	            store: Ext.create('Rally.data.custom.Store', {
	                data: records,
	                pageSize: 3
	            }),
	            
	            pagingToolbarCfg: {
	               pageSizes: [5, 10, 25]
	            },
	
	            columnCfgs: [
	                {
	                    text: 'ID', dataIndex: 'FormattedID'
	                },
	                {
	                    text: 'Name', dataIndex: 'Name', flex: 1
	                },
	                {
	                    text: 'Schedule State', dataIndex: 'ScheduleState'
	                },
	                {
	                    text: 'Date Created', dataIndex: 'CreationDate'
	                },
	                {
	                    text: 'Created By', dataIndex: 'CreatedBy'
	                },
	                {
	                    text: 'Owner', dataIndex: 'Owner'
	                },
	                {
	                    text: 'Accepted By', dataIndex: 'AcceptedBy'
	                }
	            ]
	        });
        }
    },


    // Called when the Release ComboBox selected-item has been changed
    _onSelect: function() {
    	
    	this.grid.setLoading(true);
    	
        var filter = new Ext.util.Filter({
            property:'Release',
            operator: '=',
            value: this.down('#releaseComboBox').getValue()
        });

        this.userStoryStore.clearFilter(true /* prevent a wsapi call when we remove old filter  */);
        this.userStoryStore.filters.add(filter);
        this.userStoryStore.load();
    },
    
    _calculateCreationDate: function(story) {
        var initialRevisionIx = story.get('RevisionHistory').Revisions.length - 1;
        var initialRevision = story.get('RevisionHistory').Revisions[initialRevisionIx];
        var cd = '' + initialRevision.CreationDate;
        cd = cd.replace(/T/, " ").replace(/\.\d+Z+/, " UTC");
        return cd;
    },
    
    _calculateOwner: function(value) {
        if(value) {
            return value._refObjectName;
        }
        return '';
    },
    	
    _calculateCreatedBy: function(story) {
        // revisions are returned in last to first order; initial revision is last in list
        var initialRevisionIx = story.get('RevisionHistory').Revisions.length - 1;
        var initialRevision = story.get('RevisionHistory').Revisions[initialRevisionIx];
        var creator = initialRevision.User._refObjectName;
        return creator;
    },

    _calculateAcceptedBy: function(story) {
        // cycle through the revisions from last towards the first looking for
        //  'changed from [Completed] to [Accepted]' in the revision.Description
        //  and grab for the author on that revision as the Acceptor value
        var acceptor = '';
        var srchIx = null;
        var scheduleState = story.get('ScheduleState');
        if ((scheduleState === 'Accepted') || (scheduleState === 'Released')) {
            acceptor = this._calculateCreatedBy(story);  // default to this
            for (j = 0; j < story.get('RevisionHistory').Revisions.length; j++) {
                var revision = story.get('RevisionHistory').Revisions[j];
                srchIx = revision.Description.search(/SCHEDULE STATE changed from \[.+\] to \[Accepted\]/);
                if (srchIx > 0) {
                    acceptor = '';
                    if (revision.User && revision.User._refObjectName) {
                        acceptor = revision.User._refObjectName;
                    }
                    break;
                }
            }
        }
        return acceptor;
    },

    _drawHeader: function(){
        var header = this.down('#header');

        header.add([
            this._buildHelpComponent()
        ]);
    },

    _buildHelpComponent:function (config) {
        return Ext.create('Ext.Component', Ext.apply({
            cls:Rally.util.Test.toBrowserTestCssClass('portfolio-kanban-help-container') + ' kanban-help ',
            renderTpl:'<a href="#" title="Launch Help for Stories-by-Creator App"></a>',	//TODO: what URL to use for this
            listeners:{
                click:{
                    element:'el',
                    fn: function(){
                        Rally.alm.util.Help.launchHelp({
                            id:250
                        });
                    },
                    stopEvent:true
                },
                scope:this
            }
        }, config));
    }

    
});
