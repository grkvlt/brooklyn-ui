/**
 * Builds a Twitter Bootstrap modal as the framework for a Wizard.
 * Also creates an empty Application model.
 */
define([
    "underscore", "jquery", "backbone", "model/entity", "./entity", "model/application", "formatJson",
    "model/location", "text!tpl/home/modal-wizard.html", 
    "text!tpl/home/step1.html", "text!tpl/home/step2.html", "text!tpl/home/step3.html", 
    "text!tpl/home/step1-location-row.html", "text!tpl/home/location-option.html",
    "text!tpl/home/location-entry.html", "text!tpl/home/entry.html", "bootstrap"
], function (_, $, Backbone, Entity, EntityView, Application, FormatJSON, Location, ModalHtml, 
		Step1Html, Step2Html, Step3Html, 
		Step1LocationRowHtml, LocationOptionHtml, LocationEntryHtml, EntryHtml) {

    var ModalWizard = Backbone.View.extend({
        tagName:'div',
        className:'modal hide fade',
        events:{
            'click #next_step':'nextStep',
            'click #prev_step':'prevStep'
        },
        template:_.template(ModalHtml),
        initialize:function () {
            this.model = new Application.Spec
            this.currentStep = 0
            this.steps = [
                {
                    step_number:1,
                    title:'Deploy Application',
                    instructions:'Enter the name of the new application and the location(s) where you wish to deploy it.',
                    view:new ModalWizard.Step1({ model:this.model})
                },
                {
                    step_number:2,
                    title:'Configure Application',
                    instructions:'Add all the entities for this application',
                    view:new ModalWizard.Step2({ model:this.model})
                },
                {
                    step_number:3,
                    title:'Application Summary',
                    instructions:'Check the details before you create the new application',
                    view:new ModalWizard.Step3({ model:this.model})
                }
            ]
        },
        beforeClose:function () {
            // ensure we close the sub-views
            _.each(this.steps, function (step) {
                step.view.close()
            }, this)
        },
        render:function () {
            this.$el.html(this.template({}))
            this.renderCurrentStep()
            return this
        },

        renderCurrentStep:function () {
            this.title = this.$("h3#step_title")
            this.instructions = this.$("p#step_instructions")
            this.nextStepButton = this.$("#next_step")
            this.prevStepButton = this.$("#prev_step")

            var currentStep = this.steps[this.currentStep]
            if (!this.isFirstStep()) var prevStep = this.steps[this.currentStep - 1]
            var nextStep = this.steps[this.currentStep + 1]

            this.title.html(currentStep.title)
            this.instructions.html(currentStep.instructions)
            this.currentView = currentStep.view
            // delegate to sub-views !!
            this.$(".modal-body").replaceWith(this.currentView.render().el)

            if (prevStep) {
                this.prevStepButton.html("Previous").show()
            } else {
                this.prevStepButton.hide()
            }
            if (nextStep) {
                this.nextStepButton.html("Next")
            } else {
                this.nextStepButton.html("Finish")
            }
        },
        submitApplication:function (event) {
            var that = this
            $.ajax({
                url:'/v1/applications',
                type:'post',
                contentType:'application/json',
                processData:false,
                data:JSON.stringify(this.model.toJSON()),
                success:function (data) {
                    var $modal = $('#modal-container .modal')
                    $modal.modal('hide')
                    if (that.options.callback) that.options.callback();
                }
            })
            return false
        },
        nextStep:function () {
            if (this.currentView.validate()) {
                if (!this.isLastStep()) {
                    this.currentStep += 1
                    this.renderCurrentStep()
                } else {
                    this.submitApplication()
                }
            }
        },
        prevStep:function () {
            if (!this.isFirstStep()) {
                this.currentStep -= 1
                this.renderCurrentStep()
            }
        },
        isFirstStep:function () {
            return (this.currentStep == 0)
        },
        isLastStep:function () {
            return (this.currentStep == this.steps.length - 1)
        }
    })

    /**
     * Wizard for creating a new application. First step: assign a name and a location for the app.
     */
    ModalWizard.Step1 = Backbone.View.extend({
        className:'modal-body',
        events:{
            'click #add-selector-container':'addLocation',
            'click #remove-app-location':'removeLocation',
            'change select':'selection',
            'change option':'selection',
            'blur #application-name':'updateName'
        },
        template:_.template(Step1Html),
        locationRowTemplate:_.template(Step1LocationRowHtml),
        locationOptionTemplate:_.template(LocationOptionHtml),

        initialize:function () {
            this.model.on("change", this.render, this)
            this.$el.html(this.template({}))
            this.locations = new Location.Collection()
        },
        beforeClose:function () {
            this.model.off("change", this.render)
        },
        getSuffix:function (location) {
            var suffix=location.getConfigByName("location");
            if (suffix==null) suffix=location.getConfigByName("endpoint")
            if (suffix!=null) suffix=":"+suffix; else suffix="";
            return suffix
        },
        renderName:function () {
            this.$('#application-name').val(this.model.get("name"))
        },
        renderAddedLocations:function () {
            // renders the locations added to the model
        	var that = this;
        	var container = this.$("#selector-container")
        	container.empty()
        	for (var li = 0; li < this.model.get("locations").length; li++) {
        		var chosenLocation = this.model.get("locations")[li];
        		container.append(that.locationRowTemplate({
        				initialValue: chosenLocation.getLinkByName("self"),
        				rowId: li
        			}))
        	}
    		var $selectLocations = container.find('#select-location')
    		this.locations.each(function(aLocation) {
        			var $option = that.locationOptionTemplate({
                        url:aLocation.getLinkByName("self"),
                        provider:aLocation.get("provider"),
                        suffix:that.getSuffix(aLocation)
                    })
                    $selectLocations.append($option)
        		})
    		$selectLocations.each(function(i) {
    			var url = $($selectLocations[i]).parent().attr('initialValue');
    			$($selectLocations[i]).val(url)
//    			$($selectLocations[i]).find('option').indexOf( function(opt) { opt.attr('')})
    		})
        },
        render:function () {
        	var that = this
            this.renderName()
            this.locations.fetch({async:false,
                success:function () {
                	if (that.model.get("locations").length==0)
                		that.addLocation()
            		else
            			that.renderAddedLocations()
                }})
            this.delegateEvents()
            return this
        },
        addLocation:function () {
        	if (this.locations.models.length>0) {
            	this.model.addLocation(this.locations.models[0])
            	this.renderAddedLocations()
        	} else {
                this.$('div.info-nolocs-message').show('slow').delay(2000).hide('slow')
        	}
        },
        removeLocation:function (event) {
            var toBeRemoved = $(event.currentTarget).parent().attr('rowId')
            this.model.removeLocationIndex(toBeRemoved)
            this.renderAddedLocations()
        },
        selection:function (event) {
        	var url = $(event.currentTarget).val();
        	var loc = this.locations.find(function (candidate) {
        		return candidate.getLinkByName("self")==url
    		})
        	this.model.setLocationAtIndex($(event.currentTarget).parent().attr('rowId'), loc)
        },
        updateName:function () {
            this.model.set("name", this.$('#application-name').val())
        },
        validate:function () {
            if (this.model.get("name") !== "" && this.model.get("locations").length !== 0) {
                return true
            }
            this.$('div.info-message').show('slow').delay(2000).hide('slow')
            return false
        }
    })

    /**
     * Second step from the create application wizard. Allows you to add and new entities and configure them.
     */
    ModalWizard.Step2 = Backbone.View.extend({
        className:'modal-body',
        events:{
            'click #add-app-entity':'addEntity',
            'click .remove':'removeEntity',
            'click #toggle-entity-form':'toggleEntityForm'
        },
        template:_.template(Step2Html),
        initialize:function () {
            this.$el.html(this.template({}))
            this.model.on("change", this.render, this)
            this.entity = new Entity.Model
        },
        beforeClose:function () {
            this.model.off("change", this.render)
        },
        renderConfiguredEntities:function () {
            var $configuredEntities = this.$('#entities ul').empty()
            if (this.model.get("entities").length > 0) {
                this.$('#entities h4').text('Configured entities')
                _.each(this.model.get("entities"), function (entity) {
                    var $entity = _.template(EntryHtml, {entry:entity.name })
                    $configuredEntities.append($entity)
                })
            } else {
                this.$('#entities h4').text('No entities configured')
            }
        },
        renderEntityForm:function () {
            this.$('#entity-form').replaceWith(new EntityView({model:this.entity}).render().el)
        },
        render:function () {
            this.renderConfiguredEntities()
            this.renderEntityForm()
            this.delegateEvents()
            return this
        },
        toggleEntityForm:function () {
            this.$('#new-entity').toggle()
        },
        addEntity:function () {
            if (this.entity.get("name").length > 0 &&
                this.entity.get("type").length > 0) {

                this.model.addEntity(this.entity)
                this.$('#new-entity').hide()
                this.entity = new Entity.Model()
                this.render()
            } else {
                this.$('div.entity-info-message').show('slow').delay(2000).hide('slow')
            }
        },
        removeEntity:function (event) {
            var name = $(event.currentTarget).siblings('span').text()
            this.model.removeEntityByName(name)
        },
        validate:function () {
            if (this.model.get("entities").length > 0) {
                return true
            }
            this.$('div.info-message').show('slow').delay(2000).hide('slow')
            return false
        }
    })
    /**
     * Final step from the create application wizard. Review the summary and submit the request.
     */
    ModalWizard.Step3 = Backbone.View.extend({
        className:'modal-body',
        initialize:function () {
            this.$el.html(_.template(Step3Html))
            this.model.on("change", this.render, this)
        },
        beforeClose:function () {
            this.model.off("change", this.render)
        },
        render:function () {
            this.$('#app-summary').val(FormatJSON(this.model.toJSON()))
            this.delegateEvents()
            return this
        },
        validate:function () {
            if (this.model.get("name") != ""
                && this.model.get("locations").length > 0
                && this.model.get("entities").length > 0) {
                return true
            }
            this.$('div.info-message').show('slow').delay(2000).hide('slow')
            return false
        }
    })

    return ModalWizard
})