import * as React from "react"
import { View } from "@tarojs/components"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
} | null>(null)

const Tabs = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View> & {
      value?: string
      defaultValue?: string
      onValueChange?: (value: string) => void
  }
>(({ className, value: valueProp, defaultValue, onValueChange, ...props }, ref) => {
    const [valueState, setValueState] = React.useState<string | undefined>(defaultValue)
    const value = valueProp !== undefined ? valueProp : valueState
    
    const handleValueChange = (newValue: string) => {
        if (valueProp === undefined) {
            setValueState(newValue)
        }
        onValueChange?.(newValue)
    }

  return (
      <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
        <View
          ref={ref}
          className={cn(className)}
          {...props}
        />
    </TabsContext.Provider>
  )
})
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      "flex flex-row h-12 items-center justify-center rounded-xl bg-gray-100 p-1",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View> & {
      value: string
      disabled?: boolean
  }
>(({ className, value, onClick, disabled, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isActive = context?.value === value
    
    const handleClick = (e: any) => {
        if (disabled) return
        context?.onValueChange?.(value)
        onClick?.(e)
    }

  return (
    <View
      ref={ref}
      onClick={handleClick}
      className={cn(
        "flex-1 flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all",
        isActive 
          ? "bg-white text-blue-500 shadow-sm" 
          : "text-gray-500",
        disabled && "opacity-50",
        className
        )}
      hoverClass={
        disabled
          ? undefined
          : "bg-white shadow-sm"
      }
      {...props}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View> & {
      value: string
  }
>(({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (context?.value !== value) return null

  return (
    <View
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
        className
      )}
      {...props}
    />
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
